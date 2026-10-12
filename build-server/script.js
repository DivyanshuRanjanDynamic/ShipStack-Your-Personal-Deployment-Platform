const { exec, execFile } = require("child_process");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const fs = require("fs");
const { Kafka } = require('kafkajs');

const s3Cilent = new S3Client({
    region: process.env.ECS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.ECS_ACCESSKEY_ID,
        secretAccessKey: process.env.ECS_SECRET_ACCESSKEY
    }
});

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const GIT_REPOSITORY_URL = process.env.GIT_REPOSITORY_URL;

const kafka = new Kafka({
    clientId: `build-server-${DEPLOYMENT_ID}`,
    brokers: [process.env.KAFKA_BROKER],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        mechanism: 'PLAIN',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
    }
})

const producer = kafka.producer();

async function publishLog(log, step = null, event = null, exit_code = undefined, failure_reason = null) {
    try {
        const payload = { log, PROJECT_ID, DEPLOYMENT_ID };
        if (step) payload.step = step;
        if (event) payload.event = event;
        if (exit_code !== undefined) payload.exit_code = exit_code;
        if (failure_reason) payload.failure_reason = failure_reason;

        await producer.send({
            topic: 'container-logs',
            messages: [{ key: 'log', value: JSON.stringify(payload) }]
        })
    } catch (error) {
        console.log('Log Push Krte time error h..');
        console.log(error);
    }
}

async function safeExit(code) {
    try {
        await producer.disconnect();
    } catch (e) {
        console.error('Error disconnecting Kafka producer:', e);
    }
    process.exit(code);
}

async function runStep(command, cwd, stepName, failReason) {
    await publishLog(`[${stepName}:start]`, stepName, 'step_start');
    return new Promise((resolve) => {
        const proc = exec(command, { cwd });
        proc.stdout.on('data', async (data) => {
            console.log(data.toString());
            await publishLog(`[${stepName}] ${data.toString()}`, stepName);
        });
        proc.stderr.on('data', async (data) => {
            console.error(data.toString());
            await publishLog(`[${stepName}] ${data.toString()}`, stepName);
        });
        proc.on('close', async (exitCode) => {
            console.log(`${stepName} exited with code ${exitCode}`);
            if (exitCode !== 0) {
                await publishLog(`[${stepName}:end] exit_code=${exitCode}`, stepName, 'step_end', exitCode, failReason);
                resolve(false);
            } else {
                await publishLog(`[${stepName}:end] exit_code=${exitCode}`, stepName, 'step_end', exitCode);
                resolve(true);
            }
        });
    });
}

async function uploadBuildContext(outDirPath, buildCmd, expectedOutputDir) {
    const pkgPath = path.join(outDirPath, 'package.json');
    let pkg = {};
    if (fs.existsSync(pkgPath)) {
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (e) { }
    }

    let framework = 'unknown';
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps.next) framework = 'next';
    else if (deps['react-scripts']) framework = 'cra';
    else if (deps.vite) framework = 'vite';

    let packageManager = 'npm';
    if (fs.existsSync(path.join(outDirPath, 'yarn.lock'))) packageManager = 'yarn';
    else if (fs.existsSync(path.join(outDirPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';

    const hasLockfile = fs.existsSync(path.join(outDirPath, 'package-lock.json')) ||
        fs.existsSync(path.join(outDirPath, 'yarn.lock')) ||
        fs.existsSync(path.join(outDirPath, 'pnpm-lock.yaml'));

    const buildContext = {
        deployment_id: DEPLOYMENT_ID,
        git_url: GIT_REPOSITORY_URL,
        framework,
        package_manager: packageManager,
        node_version: process.version,
        engines: pkg.engines || null,
        scripts: pkg.scripts || null,
        build_command: buildCmd,
        expected_output_dir: expectedOutputDir,
        has_lockfile: hasLockfile,
        captured_at: new Date().toISOString()
    };

    try {
        const command = new PutObjectCommand({
            Bucket: "shipstack-s3",
            Key: `__meta/${DEPLOYMENT_ID}/build-context.json`,
            Body: JSON.stringify(buildContext),
            ContentType: 'application/json'
        });
        await s3Cilent.send(command);
        console.log('Build context uploaded');
    } catch (err) {
        console.error('Failed to upload build context:', err);
    }
}

async function init() {
    try {
        await producer.connect();
        console.log('Kafka producer connected successfully');
    } catch (err) {
        console.error('Failed to connect to Kafka producer:', err.message);
        process.exit(1);
    }

    console.log('Executing script.js......');
    await publishLog('Starting the build process......');

    const repoPath = path.join(__dirname, 'output');

    // 1. Clone Step — validate URL to prevent command injection
    try {
        const parsed = new URL(GIT_REPOSITORY_URL);
        if (!['https:', 'http:', 'ssh:'].includes(parsed.protocol)) {
            throw new Error(`Unsupported protocol: ${parsed.protocol}`);
        }
    } catch (err) {
        console.error('Invalid GIT_REPOSITORY_URL:', err.message);
        await publishLog(`Invalid repository URL: ${err.message}`, 'clone', 'step_end', 1, 'CLONE_FAILED');
        await publishLog('Build process failed! Cannot proceed to upload.');
        await safeExit(1);
        return;
    }

    console.log('Cloning repository...');
    await publishLog(`Cloning repository...`);
    // Use execFile (no shell) to prevent command injection via URL
    await publishLog(`[clone:start]`, 'clone', 'step_start');
    const cloneSuccess = await new Promise((resolve) => {
        const proc = execFile('git', ['clone', GIT_REPOSITORY_URL, repoPath], { cwd: __dirname });
        proc.stdout.on('data', async (data) => {
            console.log(data.toString());
            await publishLog(`[clone] ${data.toString()}`, 'clone');
        });
        proc.stderr.on('data', async (data) => {
            console.error(data.toString());
            await publishLog(`[clone] ${data.toString()}`, 'clone');
        });
        proc.on('close', async (exitCode) => {
            console.log(`clone exited with code ${exitCode}`);
            if (exitCode !== 0) {
                await publishLog(`[clone:end] exit_code=${exitCode}`, 'clone', 'step_end', exitCode, 'CLONE_FAILED');
                resolve(false);
            } else {
                await publishLog(`[clone:end] exit_code=${exitCode}`, 'clone', 'step_end', exitCode);
                resolve(true);
            }
        });
    });
    if (!cloneSuccess) {
        await publishLog('Build process failed! Cannot proceed to upload.');
        await safeExit(1);
        return;
    }

    let outDirPath = repoPath;
    if (!fs.existsSync(path.join(outDirPath, 'package.json'))) {
        const entries = fs.readdirSync(outDirPath);
        for (const entry of entries) {
            const entryPath = path.join(outDirPath, entry);
            if (fs.lstatSync(entryPath).isDirectory() && fs.existsSync(path.join(entryPath, 'package.json'))) {
                outDirPath = entryPath;
                break;
            }
        }
    }

    const pkgPath = path.join(outDirPath, 'package.json');
    let buildCmd = 'npm run build';
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts.build) {
                buildCmd = 'npx vite build';
            }
        } catch (e) { }
    } else {
        await publishLog('No package.json found in cloned repository!', 'build', null, 1, 'NONZERO_EXIT');
        await publishLog('Build process failed! Cannot proceed to upload.');
        await safeExit(1);
        return;
    }

    await uploadBuildContext(outDirPath, buildCmd, 'dist'); // Using 'dist' as a reasonable guess, will verify below

    // 2. Install Step
    console.log('Installing dependencies...');
    const installSuccess = await runStep('npm install', outDirPath, 'install', 'NONZERO_EXIT');
    if (!installSuccess) {
        await publishLog('Build process failed! Cannot proceed to upload.');
        await safeExit(1);
        return;
    }

    // 3. Build Step
    console.log(`Running build command: ${buildCmd}`);
    const buildSuccess = await runStep(buildCmd, outDirPath, 'build', 'NONZERO_EXIT');
    if (!buildSuccess) {
        await publishLog('Build process failed! Cannot proceed to upload.');
        await safeExit(1);
        return;
    }

    console.log('Build Process Done');
    await publishLog('Build Process Done');

    // 4. Upload Step
    await publishLog(`[upload:start]`, 'upload', 'step_start');
    
    let distFolderPath = path.join(outDirPath, 'dist');
    if (!fs.existsSync(distFolderPath)) {
        const altBuildPath = path.join(outDirPath, 'build');
        if (fs.existsSync(altBuildPath)) {
            distFolderPath = altBuildPath;
        } else {
            console.error(`Error: Neither 'dist' nor 'build' directory exists in '${outDirPath}'.`);
            await publishLog(`Error: Neither 'dist' nor 'build' directory exists in '${outDirPath}'.`);
            await publishLog(`[upload:end] exit_code=1`, 'upload', 'step_end', 1, 'UPLOAD_EMPTY');
            await publishLog('Build process failed! Cannot proceed to upload.');
            await safeExit(1);
            return;
        }
    }

    const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });
    if (distFolderContents.length === 0) {
        await publishLog(`Error: output directory is empty.`);
        await publishLog(`[upload:end] exit_code=1`, 'upload', 'step_end', 1, 'UPLOAD_EMPTY');
        await publishLog('Build process failed! Cannot proceed to upload.');
        await safeExit(1);
        return;
    }

    console.log('Starting to upload to S3...');
    await publishLog('Starting to upload to S3...');

    for (const file of distFolderContents) {
        const filePath = path.join(distFolderPath, file);
        if (fs.lstatSync(filePath).isDirectory()) continue;

        const normalizedFileKey = file.replace(/\\/g, '/');
        try {
            const command = new PutObjectCommand({
                Bucket: "shipstack-s3",
                Key: `__outputs/${PROJECT_ID}/${normalizedFileKey}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) || 'application/octet-stream'
            });

            await s3Cilent.send(command);
        } catch (err) {
            console.error(`Failed to upload ${filePath} to S3:`, err);
            await publishLog(`Failed to upload ${filePath} to S3: ${err.message}`);
        }
    }

    await publishLog(`[upload:end] exit_code=0`, 'upload', 'step_end', 0);
    console.log('Uploading to S3 Done!!!!!!');
    await publishLog('Uploading to S3 Done!!!!!!');
    await safeExit(0);
}

init();

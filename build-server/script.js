const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const {
    createKafkaLogSink,
    createStdoutLogSink,
    createS3ObjectSink,
    createLocalObjectSink,
} = require('./lib/sinks');
const { runStep, runCommand, startShell } = require('./lib/run-step');
const { selectRootDirectory, describeRootSelection, readPackageJson, detectFramework } = require('./lib/detect');
const { planInstall, runInstall, planBuild } = require('./lib/install');
const { selectNodeForProject, needsLegacyOpenSSL, appendNodeOption, describeNodeSelection } = require('./lib/node-version');
const { resolveOutputDir } = require('./lib/output-dir');
const { uploadDirectory } = require('./lib/upload');
const { createBuildContext, uploadBuildContext } = require('./lib/build-context');

// LOCAL_RUN=1: logs to stdout, objects to a local folder, no Kafka, no S3, no credentials.
const LOCAL_RUN = process.env.LOCAL_RUN === '1';

const PROJECT_ID = process.env.PROJECT_ID || (LOCAL_RUN ? 'local-project' : undefined);
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID || (LOCAL_RUN ? `local-${Date.now()}` : undefined);
const GIT_REPOSITORY_URL = process.env.GIT_REPOSITORY_URL;

// Local runs may clone from a folder on disk (file://) so fixture repos need no network.
const ALLOWED_CLONE_PROTOCOLS = LOCAL_RUN ? ['https:', 'http:', 'ssh:', 'file:'] : ['https:', 'http:', 'ssh:'];

function createProductionSinks() {
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const { Kafka } = require('kafkajs');

    const s3Client = new S3Client({
        region: process.env.ECS_REGION || 'eu-north-1',
        credentials: {
            accessKeyId: process.env.ECS_ACCESSKEY_ID,
            secretAccessKey: process.env.ECS_SECRET_ACCESSKEY
        }
    });

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
    });
    const producer = kafka.producer();

    return {
        connect: () => producer.connect(),
        logSink: createKafkaLogSink({ producer, projectId: PROJECT_ID, deploymentId: DEPLOYMENT_ID }),
        objectSink: createS3ObjectSink({ client: s3Client, bucket: 'shipstack-s3', PutObjectCommand }),
        repoPath: path.join(__dirname, 'output'),
    };
}

function createLocalSinks() {
    const outputRoot = path.resolve(process.env.LOCAL_OUTPUT_DIR || path.join(__dirname, 'local-output'));
    return {
        connect: async () => { },
        logSink: createStdoutLogSink(),
        objectSink: createLocalObjectSink({ rootDir: outputRoot }),
        repoPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shipstack-build-')), 'output'),
        outputRoot,
    };
}

async function init() {
    const sinks = LOCAL_RUN ? createLocalSinks() : createProductionSinks();
    const { logSink, objectSink, repoPath } = sinks;
    const echo = !LOCAL_RUN;

    async function safeExit(code) {
        await logSink.close();
        process.exit(code);
    }

    async function fail() {
        await logSink.publish({ log: 'Build process failed! Cannot proceed to upload.' });
        await safeExit(1);
    }

    try {
        await sinks.connect();
        if (!LOCAL_RUN) console.log('Kafka producer connected successfully');
    } catch (err) {
        console.error('Failed to connect to Kafka producer:', err.message);
        process.exit(1);
    }

    if (LOCAL_RUN) console.log(`LOCAL_RUN: deployment ${DEPLOYMENT_ID}, objects in ${sinks.outputRoot}`);
    console.log('Executing script.js......');
    await logSink.publish({ log: 'Starting the build process......' });

    // 1. Clone Step — validate URL to prevent command injection
    try {
        const parsed = new URL(GIT_REPOSITORY_URL);
        if (!ALLOWED_CLONE_PROTOCOLS.includes(parsed.protocol)) {
            throw new Error(`Unsupported protocol: ${parsed.protocol}`);
        }
    } catch (err) {
        console.error('Invalid GIT_REPOSITORY_URL:', err.message);
        await logSink.publish({ log: `Invalid repository URL: ${err.message}`, step: 'clone', event: 'step_end', exit_code: 1, failure_reason: 'CLONE_FAILED' });
        await fail();
        return;
    }

    if (echo) console.log('Cloning repository...');
    await logSink.publish({ log: `Cloning repository...` });
    // Use execFile (no shell) to prevent command injection via URL
    const clone = await runStep({
        start: () => execFile('git', ['clone', GIT_REPOSITORY_URL, repoPath], { cwd: __dirname }),
        stepName: 'clone',
        failReason: 'CLONE_FAILED',
        logSink,
        echo,
    });
    if (!clone.ok) {
        await fail();
        return;
    }

    // Setup failures happen before install runs, so they are reported as the install step.
    const root = selectRootDirectory(repoPath);
    for (const line of describeRootSelection(root)) {
        await logSink.publish({ log: line });
    }
    if (!root.ok) {
        await logSink.publish({ log: `[install:end] exit_code=1`, step: 'install', event: 'step_end', exit_code: 1, failure_reason: root.failureReason });
        await fail();
        return;
    }
    const projectDir = root.dir;
    const projectPkg = readPackageJson(projectDir) || {};

    const installPlan = planInstall({ repoPath, projectDir });
    for (const line of installPlan.logLines) {
        await logSink.publish({ log: line });
    }
    const buildPlan = installPlan.ok ? planBuild({ projectDir, manager: installPlan.manager }) : null;
    if (buildPlan) {
        for (const line of buildPlan.logLines) {
            await logSink.publish({ log: line });
        }
    }

    // Node version and legacy OpenSSL decision; both apply to install and build.
    const nodeSelection = selectNodeForProject({ projectDir, pkg: projectPkg, setting: process.env.NODE_VERSION || null });
    const legacyOpenSSL = needsLegacyOpenSSL({ major: nodeSelection.major, pkg: projectPkg });
    for (const line of describeNodeSelection(nodeSelection, legacyOpenSSL)) {
        await logSink.publish({ log: line });
    }

    const childEnvOverrides = { PATH: `${nodeSelection.binDir}${path.delimiter}${process.env.PATH || ''}` };
    const nodeOptions = legacyOpenSSL
        ? appendNodeOption(process.env.NODE_OPTIONS, '--openssl-legacy-provider')
        : (process.env.NODE_OPTIONS || '');
    if (nodeOptions) childEnvOverrides.NODE_OPTIONS = nodeOptions;
    const childEnv = { ...process.env, ...childEnvOverrides };

    await uploadBuildContext({
        objectSink,
        context: createBuildContext({
            projectDir,
            installDir: installPlan.ok ? installPlan.cwd : projectDir,
            packageManager: installPlan.ok ? installPlan.manager : null,
            deploymentId: DEPLOYMENT_ID,
            gitUrl: GIT_REPOSITORY_URL,
            buildCommand: buildPlan && buildPlan.ok ? buildPlan.command : null,
            expectedOutputDir: 'dist', // Using 'dist' as a reasonable guess, will verify below
            nodeVersion: nodeSelection.version,
        }),
    });

    if (!installPlan.ok) {
        await logSink.publish({ log: `[install:end] exit_code=1`, step: 'install', event: 'step_end', exit_code: 1, failure_reason: installPlan.failureReason });
        await fail();
        return;
    }
    if (!buildPlan.ok) {
        await logSink.publish({ log: `[build:end] exit_code=1`, step: 'build', event: 'step_end', exit_code: 1, failure_reason: buildPlan.failureReason });
        await fail();
        return;
    }
    const buildCmd = buildPlan.command;

    // 2. Install Step
    console.log('Installing dependencies...');
    const install = await runInstall({
        plan: installPlan,
        run: (command) => runCommand({ start: () => startShell(command, { cwd: installPlan.cwd, env: childEnv }), stepName: 'install', logSink, echo }),
        logSink,
    });
    if (!install.ok) {
        await fail();
        return;
    }

    // 3. Build Step
    console.log(`Running build command: ${buildCmd}`);
    const buildStartedMs = Date.now();
    const build = await runStep({
        start: () => startShell(buildCmd, { cwd: projectDir, env: childEnv }),
        stepName: 'build',
        failReason: 'NONZERO_EXIT',
        logSink,
        echo,
    });
    if (!build.ok) {
        await fail();
        return;
    }

    if (echo) console.log('Build Process Done');
    await logSink.publish({ log: 'Build Process Done' });

    // 4. Upload Step
    await logSink.publish({ log: `[upload:start]`, step: 'upload', event: 'step_start' });

    const output = resolveOutputDir({ projectDir, framework: detectFramework(projectPkg), buildStartedMs });
    if (!output.ok) {
        for (const line of output.logLines) {
            await logSink.publish({ log: line, step: 'upload' });
        }
        await logSink.publish({ log: `[upload:end] exit_code=1`, step: 'upload', event: 'step_end', exit_code: 1, failure_reason: output.failureReason });
        await fail();
        return;
    }
    const distFolderPath = output.dir;
    await logSink.publish({ log: `[upload] output directory: ${output.relative}`, step: 'upload' });
    if (output.warning) {
        await logSink.publish({ log: `[upload] ${output.warning}`, step: 'upload' });
    }

    if (echo) console.log('Starting to upload to S3...');
    await logSink.publish({ log: 'Starting to upload to S3...' });

    const keyPrefix = `__outputs/${PROJECT_ID}`;
    const uploadResult = await uploadDirectory({ dir: distFolderPath, keyPrefix, objectSink, logSink });
    await logSink.publish({
        log: `[upload] ${uploadResult.uploaded} file(s) uploaded, ${uploadResult.bytes} bytes, ${uploadResult.durationMs} ms`,
        step: 'upload',
    });

    // A deployment must never be reported successful with missing files.
    const indexUploaded = uploadResult.files.includes('index.html') && !uploadResult.failedKeys.includes(`${keyPrefix}/index.html`);
    if (uploadResult.failed > 0 || !indexUploaded) {
        if (uploadResult.failed > 0) {
            await logSink.publish({ log: `[upload] ${uploadResult.failed} file(s) failed to upload`, step: 'upload' });
        }
        if (!indexUploaded) {
            await logSink.publish({ log: `[upload] index.html was not uploaded`, step: 'upload' });
        }
        await logSink.publish({ log: `[upload:end] exit_code=1`, step: 'upload', event: 'step_end', exit_code: 1, failure_reason: 'UPLOAD_FAILED' });
        await fail();
        return;
    }

    await logSink.publish({ log: `[upload:end] exit_code=0`, step: 'upload', event: 'step_end', exit_code: 0 });
    if (echo) console.log('Uploading to S3 Done!!!!!!');
    await logSink.publish({ log: 'Uploading to S3 Done!!!!!!' });
    await safeExit(0);
}

init();

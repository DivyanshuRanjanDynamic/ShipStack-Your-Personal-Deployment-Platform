// here we build the code and then upload(stream) it to the S3

const { exec } = require("child_process");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const fs = require("fs");
const { Kafka } = require('kafkajs');

const s3Cilent = new S3Client({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.ECS_ACCESSKEY_ID,
        secretAccessKey: process.env.ECS_SECRET_ACCESSKEY
    }
});

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

// kafka Instance 
const kafka = new Kafka({
    clientId: `build-server-${DEPLOYMENT_ID}`,
    brokers: [process.env.KAFKA_BROKER],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')]
    },
    sasl: {
        mechanism: 'PLAIN',
        username: process.env.USERNAME,
        password: process.env.KAFKA_PASSWORD,
    }
})

const producer = kafka.producer();

// this publisher pushes the container code logs to the kafka container-logs topic
async function publishLog(log) {
    try {
        await producer.send({
            topic: 'container-logs',
            messages: [
                {
                    key: 'log',
                    value: JSON.stringify({ log, PROJECT_ID, DEPLOYMENT_ID }),
                }
            ]
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

    let outDirPath = path.join(__dirname, 'output');

    // Auto-detect the project directory: package.json might be in a subdirectory
    if (!fs.existsSync(path.join(outDirPath, 'package.json'))) {
        const entries = fs.readdirSync(outDirPath);
        for (const entry of entries) {
            const entryPath = path.join(outDirPath, entry);
            if (fs.lstatSync(entryPath).isDirectory() && fs.existsSync(path.join(entryPath, 'package.json'))) {
                console.log(`Found package.json in subdirectory: ${entry}`);
                await publishLog(`Found package.json in subdirectory: ${entry}`);
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
                console.log('No "build" script found in package.json, falling back to "npx vite build"...');
                await publishLog('No "build" script found in package.json, falling back to "npx vite build"...');
                buildCmd = 'npx vite build';
            }
        } catch (e) {
            console.log(`Failed to parse package.json: ${e}`);
            await publishLog(`Failed to parse package.json: ${e}`);
        }
    } else {
        console.log('No package.json found in cloned repository!');
        await publishLog('No package.json found in cloned repository!');
        await safeExit(1);
        return;
    }

    console.log(`Project directory: ${outDirPath}`);
    console.log(`Running build command: ${buildCmd}`);
    await publishLog(`Project directory: ${outDirPath}`);
    await publishLog(`Running build command: ${buildCmd}`);

    const buildProcess = exec(`cd ${outDirPath} && npm install && ${buildCmd}`);

    buildProcess.stdout.on('data', async (data) => {
        console.log(data.toString());
        await publishLog(`stdout: ${data.toString()}`);
    });

    buildProcess.stderr.on('data', async (data) => {
        console.error(`stderr: ${data.toString()}`);
        await publishLog(`stderr: ${data.toString()}`);
    });

    buildProcess.on('close', async (exitCode) => {
        console.log(`Build process exited with code ${exitCode}`);
        if (exitCode !== 0) {
            console.error('Build process failed! Cannot proceed to upload.');
            await publishLog('Build process failed! Cannot proceed to upload.');
            await safeExit(1);
            return;
        }

        console.log('Build Process Done');
        await publishLog('Build Process Done');

        let distFolderPath = path.join(outDirPath, 'dist');

        if (!fs.existsSync(distFolderPath)) {
            const altBuildPath = path.join(outDirPath, 'build');
            if (fs.existsSync(altBuildPath)) {
                distFolderPath = altBuildPath;
            } else {
                console.error(`Error: Neither 'dist' nor 'build' directory exists in '${outDirPath}'.`);
                await publishLog(`Error: Neither 'dist' nor 'build' directory exists in '${outDirPath}'.`);
                await safeExit(1);
                return;
            }
        }

        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });

        console.log('Starting to upload to S3...');
        await publishLog('Starting to upload to S3...');

        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file);
            if (fs.lstatSync(filePath).isDirectory()) continue;

            const normalizedFileKey = file.replace(/\\/g, '/');
            console.log('Uploading:', filePath);
            await publishLog(`Uploading: ${filePath}`);

            try {
                const command = new PutObjectCommand({
                    Bucket: "shipstack-s3",
                    Key: `__outputs/${PROJECT_ID}/${normalizedFileKey}`,
                    Body: fs.createReadStream(filePath),
                    ContentType: mime.lookup(filePath) || 'application/octet-stream'
                });

                await s3Cilent.send(command);
                console.log('Uploaded successfully:', filePath);
                await publishLog(`Uploaded successfully: ${filePath}`);
            } catch (err) {
                console.error(`Failed to upload ${filePath} to S3:`, err);
                await publishLog(`Failed to upload ${filePath} to S3: ${err.message}`);
            }
        }
        console.log('Uploading to S3 Done!!!!!!');
        await publishLog('Uploading to S3 Done!!!!!!');
        await safeExit(0);
    });
}

init();



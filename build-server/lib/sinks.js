const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

/**
 * Log sink: where build log events go.
 * Every sink exposes publish({ log, step, event, exit_code, failure_reason }) and close().
 */

// Production: one Kafka message per publish, same payload shape the API consumer reads.
function createKafkaLogSink({ producer, projectId, deploymentId, topic = 'container-logs' }) {
    async function publish({ log, step = null, event = null, exit_code = undefined, failure_reason = null }) {
        try {
            const payload = { log, PROJECT_ID: projectId, DEPLOYMENT_ID: deploymentId };
            if (step) payload.step = step;
            if (event) payload.event = event;
            if (exit_code !== undefined) payload.exit_code = exit_code;
            if (failure_reason) payload.failure_reason = failure_reason;

            await producer.send({
                topic,
                messages: [{ key: 'log', value: JSON.stringify(payload) }]
            });
        } catch (error) {
            console.log('Log Push Krte time error h..');
            console.log(error);
        }
    }

    async function close() {
        try {
            await producer.disconnect();
        } catch (e) {
            console.error('Error disconnecting Kafka producer:', e);
        }
    }

    return { publish, close };
}

// Local: print each log event to stdout. Needs no network and no credentials.
function createStdoutLogSink({ write = (text) => process.stdout.write(text) } = {}) {
    async function publish({ log, failure_reason = null }) {
        const text = String(log).replace(/\n$/, '');
        write(failure_reason ? `${text} [failure_reason=${failure_reason}]\n` : `${text}\n`);
    }

    async function close() { }

    return { publish, close };
}

/**
 * Object sink: where build outputs and metadata go.
 * Every sink exposes put(key, body, contentType); body is a string, Buffer or readable stream.
 */

// Production: S3.
function createS3ObjectSink({ client, bucket, PutObjectCommand }) {
    async function put(key, body, contentType) {
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType
        }));
    }

    return { put };
}

// Local: a folder on disk, laid out like the bucket.
function createLocalObjectSink({ rootDir }) {
    const root = path.resolve(rootDir);

    async function put(key, body) {
        const target = path.resolve(root, key);
        if (target !== root && !target.startsWith(root + path.sep)) {
            throw new Error(`Object key escapes the local output folder: ${key}`);
        }
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        if (body && typeof body.pipe === 'function') {
            await pipeline(body, fs.createWriteStream(target));
        } else {
            await fs.promises.writeFile(target, body);
        }
    }

    return { put };
}

module.exports = {
    createKafkaLogSink,
    createStdoutLogSink,
    createS3ObjectSink,
    createLocalObjectSink,
};

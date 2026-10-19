const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

/**
 * Log sink: where build log events go.
 * Every sink exposes publish({ log, step, event, exit_code, failure_reason }) and close().
 */

// Production: one Kafka message per line, same payload shape the API consumer reads, now with
// a per-process monotonic `seq` assigned synchronously so row order survives concurrent sends.
function createKafkaLogSink({ producer, projectId, deploymentId, topic = 'container-logs' }) {
    let seq = 0;

    function message(entry, s) {
        const payload = { log: entry.log, PROJECT_ID: projectId, DEPLOYMENT_ID: deploymentId, seq: s };
        if (entry.step) payload.step = entry.step;
        if (entry.event) payload.event = entry.event;
        if (entry.exit_code !== undefined) payload.exit_code = entry.exit_code;
        if (entry.failure_reason) payload.failure_reason = entry.failure_reason;
        return { key: 'log', value: JSON.stringify(payload) };
    }

    async function send(messages) {
        try {
            await producer.send({ topic, messages });
        } catch (error) {
            console.log('Log Push Krte time error h..');
            console.log(error);
        }
    }

    async function publish(entry) {
        await send([message(entry, seq++)]);
    }

    // One Kafka send for the whole chunk; seq is assigned synchronously (before the await).
    async function publishLines(entries) {
        if (!entries || entries.length === 0) return;
        const messages = entries.map((entry) => message(entry, seq++));
        await send(messages);
    }

    async function close() {
        try {
            await producer.disconnect();
        } catch (e) {
            console.error('Error disconnecting Kafka producer:', e);
        }
    }

    return { publish, publishLines, close };
}

// Local: print each log event to stdout. Needs no network and no credentials.
function createStdoutLogSink({ write = (text) => process.stdout.write(text) } = {}) {
    function writeEntry({ log, failure_reason = null }) {
        const text = String(log).replace(/\n$/, '');
        write(failure_reason ? `${text} [failure_reason=${failure_reason}]\n` : `${text}\n`);
    }

    async function publish(entry) {
        writeEntry(entry);
    }

    async function publishLines(entries) {
        for (const entry of entries || []) writeEntry(entry);
    }

    async function close() { }

    return { publish, publishLines, close };
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

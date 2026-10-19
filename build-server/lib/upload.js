const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const DEFAULT_CONCURRENCY = 16;
const DEFAULT_MAX_ATTEMPTS = 3;

// Files under `dir`, relative to it, with forward slashes (the object key form).
function listFiles(dir) {
    return fs.readdirSync(dir, { recursive: true })
        .filter((file) => !fs.lstatSync(path.join(dir, file)).isDirectory())
        .map((file) => file.replace(/\\/g, '/'));
}

function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// 100ms, 200ms, ... between retries.
function backoffMs(attempt) {
    return 100 * Math.pow(2, attempt - 1);
}

function fileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

// Runs `worker` over `items` with at most `limit` in flight.
async function runPool(items, limit, worker) {
    let next = 0;
    const runner = async () => {
        while (next < items.length) {
            const index = next++;
            await worker(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
}

// Uploads one file, retrying up to maxAttempts with backoff. A fresh stream per attempt.
async function uploadOne({ objectSink, key, filePath, contentType, maxAttempts, sleep }) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await objectSink.put(key, fs.createReadStream(filePath), contentType);
            return { ok: true };
        } catch (err) {
            lastError = err;
            if (attempt < maxAttempts) await sleep(backoffMs(attempt));
        }
    }
    return { ok: false, error: lastError };
}

/**
 * Uploads every file in `dir` under `keyPrefix`, with bounded concurrency and per-file retries.
 * Failures are counted, not swallowed. Resolves to
 * { files, uploaded, failed, failedKeys, bytes, durationMs }.
 */
async function uploadDirectory({
    dir,
    keyPrefix,
    objectSink,
    logSink,
    concurrency = DEFAULT_CONCURRENCY,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    sleep = defaultSleep,
}) {
    const files = listFiles(dir);
    const startedMs = Date.now();
    let uploaded = 0;
    let failed = 0;
    let bytes = 0;
    const failedKeys = [];

    await runPool(files, concurrency, async (rel) => {
        const filePath = path.join(dir, rel);
        const key = `${keyPrefix}/${rel}`;
        const contentType = mime.lookup(filePath) || 'application/octet-stream';
        const size = fileSize(filePath);
        const result = await uploadOne({ objectSink, key, filePath, contentType, maxAttempts, sleep });
        if (result.ok) {
            uploaded++;
            bytes += size;
        } else {
            failed++;
            failedKeys.push(key);
            console.error(`Failed to upload ${filePath} to S3:`, result.error);
            await logSink.publish({ log: `[upload] failed to upload ${rel} after ${maxAttempts} attempts: ${result.error.message}`, step: 'upload' });
        }
    });

    return { files, uploaded, failed, failedKeys, bytes, durationMs: Date.now() - startedMs };
}

module.exports = { listFiles, uploadDirectory, runPool, backoffMs, DEFAULT_CONCURRENCY, DEFAULT_MAX_ATTEMPTS };

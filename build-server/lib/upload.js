const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Files under `dir`, relative to it, with forward slashes (the object key form).
function listFiles(dir) {
    return fs.readdirSync(dir, { recursive: true })
        .filter((file) => !fs.lstatSync(path.join(dir, file)).isDirectory())
        .map((file) => file.replace(/\\/g, '/'));
}

/**
 * Uploads every file in `dir` under `keyPrefix`, one at a time.
 * A failed file is logged and skipped. Resolves to { uploaded, failed }.
 */
async function uploadDirectory({ dir, keyPrefix, objectSink, logSink }) {
    let uploaded = 0;
    let failed = 0;
    for (const key of listFiles(dir)) {
        const filePath = path.join(dir, key);
        try {
            await objectSink.put(
                `${keyPrefix}/${key}`,
                fs.createReadStream(filePath),
                mime.lookup(filePath) || 'application/octet-stream'
            );
            uploaded++;
        } catch (err) {
            failed++;
            console.error(`Failed to upload ${filePath} to S3:`, err);
            await logSink.publish({ log: `Failed to upload ${filePath} to S3: ${err.message}` });
        }
    }
    return { uploaded, failed };
}

module.exports = { listFiles, uploadDirectory };

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { makeTree, recordingLogSink } = require('./helpers');
const { listFiles, uploadDirectory } = require('../lib/upload');

function recordingObjectSink({ failKeys = [] } = {}) {
    const puts = [];
    return {
        puts,
        async put(key, body, contentType) {
            if (body && typeof body.destroy === 'function') body.destroy();
            if (failKeys.includes(key)) throw new Error('AccessDenied');
            puts.push({ key, contentType });
        },
    };
}

describe('listFiles', () => {
    it('lists nested files with forward slashes and skips folders', () => {
        const dir = makeTree({ 'index.html': '', 'assets/app.js': '', 'empty/': null });
        assert.deepStrictEqual(listFiles(dir).sort(), ['assets/app.js', 'index.html']);
    });
});

describe('uploadDirectory', () => {
    it('uploads every file under the prefix with a content type', async () => {
        const dir = makeTree({ 'index.html': '<html>', 'assets/app.js': '1', 'data.unknownext': 'x' });
        const objects = recordingObjectSink();
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: objects, logSink: recordingLogSink() });

        assert.deepStrictEqual(result, { uploaded: 3, failed: 0 });
        const byKey = Object.fromEntries(objects.puts.map((p) => [p.key, p.contentType]));
        assert.strictEqual(byKey['__outputs/p1/index.html'], 'text/html');
        assert.strictEqual(byKey['__outputs/p1/assets/app.js'], 'text/javascript');
        assert.strictEqual(byKey['__outputs/p1/data.unknownext'], 'application/octet-stream');
    });

    it('logs a failed file and continues with the rest', async () => {
        const dir = makeTree({ 'index.html': '', 'b.js': '' });
        const objects = recordingObjectSink({ failKeys: ['__outputs/p1/b.js'] });
        const logs = recordingLogSink();
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: objects, logSink: logs });

        assert.deepStrictEqual(result, { uploaded: 1, failed: 1 });
        assert.match(logs.logs()[0], /^Failed to upload .*b\.js to S3: AccessDenied$/);
    });
});

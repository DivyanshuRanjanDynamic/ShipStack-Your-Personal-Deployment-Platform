const { describe, it } = require('node:test');
const assert = require('node:assert');
const { makeTree, recordingLogSink } = require('./helpers');
const { listFiles, uploadDirectory, backoffMs } = require('../lib/upload');

const noSleep = async () => {};

// Object sink that can fail the first N attempts of a key, or fail a key forever, and
// tracks attempts per key and the peak number of concurrent puts.
function fakeObjectSink({ failTimes = {}, hardFail = [], putDelayMs = 0 } = {}) {
    const attempts = {};
    let active = 0;
    let maxActive = 0;
    return {
        attempts,
        getMaxActive: () => maxActive,
        async put(key, body, contentType) {
            active++;
            maxActive = Math.max(maxActive, active);
            if (body && typeof body.destroy === 'function') body.destroy();
            attempts[key] = (attempts[key] || 0) + 1;
            try {
                if (putDelayMs) await new Promise((r) => setTimeout(r, putDelayMs));
                else await Promise.resolve();
                if (hardFail.includes(key)) throw new Error('AccessDenied');
                if (attempts[key] <= (failTimes[key] || 0)) throw new Error('throttled');
            } finally {
                active--;
            }
        },
        contentTypeFor(key) { return this._ct && this._ct[key]; },
    };
}

describe('listFiles', () => {
    it('lists nested files with forward slashes and skips folders', () => {
        const dir = makeTree({ 'index.html': '', 'assets/app.js': '', 'empty/': null });
        assert.deepStrictEqual(listFiles(dir).sort(), ['assets/app.js', 'index.html']);
    });
});

describe('backoffMs', () => {
    it('doubles from 100ms', () => {
        assert.strictEqual(backoffMs(1), 100);
        assert.strictEqual(backoffMs(2), 200);
        assert.strictEqual(backoffMs(3), 400);
    });
});

describe('uploadDirectory', () => {
    it('uploads every file and reports totals', async () => {
        const dir = makeTree({ 'index.html': 'abcde', 'assets/app.js': '123' });
        const sink = fakeObjectSink();
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: recordingLogSink(), sleep: noSleep });

        assert.strictEqual(result.uploaded, 2);
        assert.strictEqual(result.failed, 0);
        assert.deepStrictEqual(result.failedKeys, []);
        assert.strictEqual(result.bytes, 8); // 5 + 3
        assert.ok(result.files.includes('index.html'));
        assert.ok(typeof result.durationMs === 'number');
    });

    it('retries a flaky file and succeeds within 3 attempts', async () => {
        const dir = makeTree({ 'index.html': '', 'a.js': '' });
        const sink = fakeObjectSink({ failTimes: { '__outputs/p1/a.js': 2 } });
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: recordingLogSink(), sleep: noSleep });

        assert.strictEqual(result.uploaded, 2);
        assert.strictEqual(result.failed, 0);
        assert.strictEqual(sink.attempts['__outputs/p1/a.js'], 3);
    });

    it('counts a file that fails all attempts and does not throw', async () => {
        const dir = makeTree({ 'index.html': '', 'bad.js': '', 'good.js': '' });
        const sink = fakeObjectSink({ hardFail: ['__outputs/p1/bad.js'] });
        const logs = recordingLogSink();
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: logs, sleep: noSleep });

        assert.strictEqual(result.uploaded, 2);
        assert.strictEqual(result.failed, 1);
        assert.deepStrictEqual(result.failedKeys, ['__outputs/p1/bad.js']);
        assert.strictEqual(sink.attempts['__outputs/p1/bad.js'], 3); // retried the max
        assert.match(logs.logs().join('\n'), /failed to upload bad\.js after 3 attempts: AccessDenied/);
    });

    it('surfaces a failed index.html in failedKeys', async () => {
        const dir = makeTree({ 'index.html': '', 'a.js': '' });
        const sink = fakeObjectSink({ hardFail: ['__outputs/p1/index.html'] });
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: recordingLogSink(), sleep: noSleep });
        assert.ok(result.failedKeys.includes('__outputs/p1/index.html'));
    });

    it('waits with increasing backoff between retries', async () => {
        const dir = makeTree({ 'index.html': '' });
        const sink = fakeObjectSink({ failTimes: { '__outputs/p1/index.html': 2 } });
        const waited = [];
        await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: recordingLogSink(), sleep: async (ms) => { waited.push(ms); } });
        assert.deepStrictEqual(waited, [100, 200]);
    });

    it('never exceeds the concurrency limit', async () => {
        const files = {};
        for (let i = 0; i < 40; i++) files[`f${i}.js`] = 'x';
        const dir = makeTree(files);
        const sink = fakeObjectSink({ putDelayMs: 5 });
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: recordingLogSink(), concurrency: 16, sleep: noSleep });

        assert.strictEqual(result.uploaded, 40);
        assert.ok(sink.getMaxActive() <= 16, `maxActive ${sink.getMaxActive()} should be <= 16`);
        assert.ok(sink.getMaxActive() > 1, 'should run some uploads in parallel');
    });

    it('counts bytes only for files that uploaded', async () => {
        const dir = makeTree({ 'index.html': 'aaaa', 'bad.js': 'bbbbbb' });
        const sink = fakeObjectSink({ hardFail: ['__outputs/p1/bad.js'] });
        const result = await uploadDirectory({ dir, keyPrefix: '__outputs/p1', objectSink: sink, logSink: recordingLogSink(), sleep: noSleep });
        assert.strictEqual(result.bytes, 4);
    });
});

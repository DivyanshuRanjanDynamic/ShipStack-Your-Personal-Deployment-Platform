const { describe, it } = require('node:test');
const assert = require('node:assert');
const { recordingLogSink, fakeProcess } = require('./helpers');
const { runStep, runCommand, startShell, createOutputTail } = require('../lib/run-step');

describe('runStep', () => {
    it('frames output with step_start and a successful step_end', async () => {
        const sink = recordingLogSink();
        const proc = fakeProcess();
        const done = runStep({ start: () => proc, stepName: 'install', failReason: 'NONZERO_EXIT', logSink: sink, echo: false });
        await new Promise(setImmediate);
        proc.out('added 3 packages\n');
        proc.err('npm warn deprecated x\n');
        proc.finish(0);

        assert.deepStrictEqual(await done, { ok: true, exitCode: 0, tail: 'added 3 packages\nnpm warn deprecated x\n' });
        assert.deepStrictEqual(sink.events[0], { log: '[install:start]', step: 'install', event: 'step_start' });
        assert.deepStrictEqual(sink.logs().slice(1, 3), ['[install] added 3 packages\n', '[install] npm warn deprecated x\n']);
        assert.deepStrictEqual(sink.events.at(-1), { log: '[install:end] exit_code=0', step: 'install', event: 'step_end', exit_code: 0 });
    });

    it('reports failure with the failure reason', async () => {
        const sink = recordingLogSink();
        const proc = fakeProcess();
        const done = runStep({ start: () => proc, stepName: 'build', failReason: 'NONZERO_EXIT', logSink: sink, echo: false });
        await new Promise(setImmediate);
        proc.finish(2);

        assert.deepStrictEqual(await done, { ok: false, exitCode: 2, tail: '' });
        assert.deepStrictEqual(sink.events.at(-1), {
            log: '[build:end] exit_code=2',
            step: 'build',
            event: 'step_end',
            exit_code: 2,
            failure_reason: 'NONZERO_EXIT',
        });
    });

    it('treats a process killed without an exit code as a failure', async () => {
        const sink = recordingLogSink();
        const proc = fakeProcess();
        const done = runStep({ start: () => proc, stepName: 'build', failReason: 'NONZERO_EXIT', logSink: sink, echo: false });
        await new Promise(setImmediate);
        proc.finish(null);
        assert.strictEqual((await done).ok, false);
    });

    it('starts the process only after step_start is published', async () => {
        const order = [];
        const sink = { publish: async (e) => { order.push(e.event || 'log'); }, close: async () => { } };
        const proc = fakeProcess();
        const done = runStep({ start: () => { order.push('spawn'); return proc; }, stepName: 'clone', failReason: 'CLONE_FAILED', logSink: sink, echo: false });
        await new Promise(setImmediate);
        proc.finish(0);
        await done;
        assert.deepStrictEqual(order.slice(0, 2), ['step_start', 'spawn']);
    });
});

describe('createOutputTail', () => {
    it('keeps everything while under the limits', () => {
        const tail = createOutputTail();
        tail.push('a\n');
        tail.push('b\n');
        assert.strictEqual(tail.toString(), 'a\nb\n');
    });

    it('keeps only the last 200 lines', () => {
        const tail = createOutputTail();
        for (let i = 1; i <= 500; i++) tail.push(`line ${i}\n`);
        const lines = tail.toString().split('\n');
        assert.strictEqual(lines.length, 200);
        assert.strictEqual(lines.at(-2), 'line 500');
        assert.ok(!tail.toString().includes('line 300\n'));
    });

    it('keeps at most 64 KB', () => {
        const tail = createOutputTail();
        tail.push('x'.repeat(100 * 1024));
        tail.push('END');
        assert.ok(Buffer.byteLength(tail.toString()) <= 64 * 1024);
        assert.ok(tail.toString().endsWith('END'));
    });

    it('does not leave a broken multi-byte character at the cut', () => {
        const tail = createOutputTail({ maxBytes: 5 });
        tail.push('ééééé');
        assert.ok(!tail.toString().includes('�'));
        assert.ok(Buffer.byteLength(tail.toString()) <= 5);
    });
});

describe('runCommand', () => {
    it('returns the exit code and the output tail without step framing', async () => {
        const sink = recordingLogSink();
        const proc = fakeProcess();
        const done = runCommand({ start: () => proc, stepName: 'install', logSink: sink, echo: false });
        proc.err('npm error code ERESOLVE\n');
        proc.finish(1);
        assert.deepStrictEqual(await done, { exitCode: 1, tail: 'npm error code ERESOLVE\n' });
        assert.ok(sink.events.every((e) => !e.event));
    });

    it('resolves once when the process cannot be spawned', async () => {
        const sink = recordingLogSink();
        const proc = fakeProcess();
        const done = runCommand({ start: () => proc, stepName: 'build', logSink: sink, echo: false });
        proc.emit('error', new Error('spawn /bin/sh ENOENT'));
        proc.finish(null);
        assert.deepStrictEqual(await done, { exitCode: 1, tail: 'spawn /bin/sh ENOENT\n' });
    });
});

describe('startShell', () => {
    it('runs a shell command and is not killed by more than 1 MB of output (exec maxBuffer)', async () => {
        const script = "process.stdout.write('x'.repeat(3 * 1024 * 1024)); process.stdout.write('DONE')";
        const result = await runCommand({
            start: () => startShell(`node -e "${script}"`, { cwd: __dirname }),
            stepName: 'build',
            logSink: { publish: async () => { }, close: async () => { } },
            echo: false,
        });
        assert.strictEqual(result.exitCode, 0);
        assert.ok(result.tail.endsWith('DONE'));
    });
});

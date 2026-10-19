const { describe, it } = require('node:test');
const assert = require('node:assert');
const { recordingLogSink, fakeProcess } = require('./helpers');
const { runStep } = require('../lib/run-step');

describe('runStep', () => {
    it('frames output with step_start and a successful step_end', async () => {
        const sink = recordingLogSink();
        const proc = fakeProcess();
        const done = runStep({ start: () => proc, stepName: 'install', failReason: 'NONZERO_EXIT', logSink: sink, echo: false });
        await new Promise(setImmediate);
        proc.out('added 3 packages\n');
        proc.err('npm warn deprecated x\n');
        proc.finish(0);

        assert.deepStrictEqual(await done, { ok: true, exitCode: 0 });
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

        assert.deepStrictEqual(await done, { ok: false, exitCode: 2 });
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

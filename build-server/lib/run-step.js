const { spawn } = require('child_process');
const { createLineBuffer } = require('./log-lines');

const TAIL_MAX_LINES = 200;
const TAIL_MAX_BYTES = 64 * 1024;

/**
 * Keeps the last `maxLines` lines / `maxBytes` bytes of a process's output, so rules such as the
 * ERESOLVE check work on what the process printed without depending on Kafka.
 */
function createOutputTail({ maxLines = TAIL_MAX_LINES, maxBytes = TAIL_MAX_BYTES } = {}) {
    let text = '';

    function push(chunk) {
        text += chunk;
        if (Buffer.byteLength(text) > maxBytes) {
            const bytes = Buffer.from(text);
            // Drop a split UTF-8 sequence at the cut instead of keeping a broken character.
            text = bytes.subarray(bytes.length - maxBytes).toString().replace(/^�+/, '');
        }
    }

    function toString() {
        const lines = text.split('\n');
        return lines.length > maxLines ? lines.slice(lines.length - maxLines).join('\n') : text;
    }

    return { push, toString };
}

/**
 * Runs a command through /bin/sh like exec(), but without exec's output buffer
 * (exec kills the child once maxBuffer, 1 MB by default, is exceeded).
 */
function startShell(command, options) {
    return spawn(command, { ...options, shell: true });
}

/**
 * Streams one process's output to the log sink as `[stepName] ...` lines.
 * `start` returns the ChildProcess. Resolves to { exitCode, tail }.
 */
function runCommand({ start, stepName, logSink, echo = true }) {
    return new Promise((resolve) => {
        const tail = createOutputTail();
        const outLines = createLineBuffer();
        const errLines = createLineBuffer();
        const proc = start();
        let settled = false;

        // Publish the complete lines from a chunk as one batch (one Kafka send, synchronous seq).
        const publishChunk = async (lines) => {
            if (lines.length === 0) return;
            await logSink.publishLines(lines.map((line) => ({ log: `[${stepName}] ${line}`, step: stepName })));
        };

        const finish = async (exitCode) => {
            if (settled) return;
            settled = true;
            // Flush any partial last line left in either stream.
            const remainder = [outLines.flush(), errLines.flush()].filter((l) => l !== '');
            if (remainder.length > 0) {
                await logSink.publishLines(remainder.map((line) => ({ log: `[${stepName}] ${line}`, step: stepName })));
            }
            if (echo) console.log(`${stepName} exited with code ${exitCode}`);
            resolve({ exitCode, tail: tail.toString() });
        };

        proc.stdout.on('data', async (data) => {
            const text = data.toString();
            tail.push(text);
            if (echo) console.log(text);
            await publishChunk(outLines.push(text));
        });
        proc.stderr.on('data', async (data) => {
            const text = data.toString();
            tail.push(text);
            if (echo) console.error(text);
            await publishChunk(errLines.push(text));
        });
        // A command that cannot be spawned at all reports through 'error' and may or may not emit 'close'.
        let spawnFailed = false;
        proc.on('error', async (err) => {
            spawnFailed = true;
            tail.push(`${err.message}\n`);
            await logSink.publishLines([{ log: `[${stepName}] ${err.message}`, step: stepName }]);
            await finish(1);
        });
        proc.on('close', (exitCode) => {
            if (!spawnFailed) finish(exitCode);
        });
    });
}

async function publishStepStart(logSink, stepName) {
    await logSink.publish({ log: `[${stepName}:start]`, step: stepName, event: 'step_start' });
}

async function publishStepEnd(logSink, stepName, exitCode, failReason) {
    const event = { log: `[${stepName}:end] exit_code=${exitCode}`, step: stepName, event: 'step_end', exit_code: exitCode };
    if (exitCode !== 0) event.failure_reason = failReason;
    await logSink.publish(event);
}

/**
 * One command framed by step_start / step_end. `start` is called after step_start is published.
 * Resolves to { ok, exitCode, tail }.
 */
async function runStep({ start, stepName, failReason, logSink, echo = true }) {
    await publishStepStart(logSink, stepName);
    const { exitCode, tail } = await runCommand({ start, stepName, logSink, echo });
    await publishStepEnd(logSink, stepName, exitCode, failReason);
    return { ok: exitCode === 0, exitCode, tail };
}

module.exports = {
    createOutputTail,
    startShell,
    runCommand,
    publishStepStart,
    publishStepEnd,
    runStep,
};

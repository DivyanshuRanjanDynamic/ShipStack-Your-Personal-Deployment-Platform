/**
 * Streams a child process's output to the log sink, framed by step_start / step_end events.
 * The caller spawns the process (exec or execFile) so this works for any command.
 *
 * `start` is called after step_start is published and must return the ChildProcess.
 * Resolves to { ok, exitCode }.
 */
async function runStep({ start, stepName, failReason, logSink, echo = true }) {
    await logSink.publish({ log: `[${stepName}:start]`, step: stepName, event: 'step_start' });
    return new Promise((resolve) => {
        const proc = start();
        proc.stdout.on('data', async (data) => {
            if (echo) console.log(data.toString());
            await logSink.publish({ log: `[${stepName}] ${data.toString()}`, step: stepName });
        });
        proc.stderr.on('data', async (data) => {
            if (echo) console.error(data.toString());
            await logSink.publish({ log: `[${stepName}] ${data.toString()}`, step: stepName });
        });
        proc.on('close', async (exitCode) => {
            if (echo) console.log(`${stepName} exited with code ${exitCode}`);
            if (exitCode !== 0) {
                await logSink.publish({
                    log: `[${stepName}:end] exit_code=${exitCode}`,
                    step: stepName,
                    event: 'step_end',
                    exit_code: exitCode,
                    failure_reason: failReason,
                });
                resolve({ ok: false, exitCode });
            } else {
                await logSink.publish({
                    log: `[${stepName}:end] exit_code=${exitCode}`,
                    step: stepName,
                    event: 'step_end',
                    exit_code: exitCode,
                });
                resolve({ ok: true, exitCode });
            }
        });
    });
}

module.exports = { runStep };

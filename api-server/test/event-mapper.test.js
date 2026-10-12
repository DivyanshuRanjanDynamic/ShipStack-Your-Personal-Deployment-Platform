const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { mapEcsEventToFailureReason, parseEcsEvent } = require('../src/event-mapper');

function loadFixture(filename) {
    const filePath = path.join(__dirname, 'fixtures', 'ecs-events', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('ECS Event Mapper (Fixture-driven)', () => {
    it('correctly maps normal success to null (not a failure)', () => {
        const fixture = loadFixture('task-stopped-success.json');
        const parsed = parseEcsEvent(fixture);

        assert.ok(parsed);
        assert.strictEqual(parsed.lastStatus, 'STOPPED');
        assert.strictEqual(parsed.exitCode, 0);

        const reason = mapEcsEventToFailureReason(parsed.rawDetail, { timedOut: false });
        assert.strictEqual(reason, null);
    });

    it('correctly maps normal nonzero exit to NONZERO_EXIT', () => {
        const fixture = loadFixture('task-stopped-nonzero-exit.json');
        const parsed = parseEcsEvent(fixture);

        assert.ok(parsed);
        assert.strictEqual(parsed.lastStatus, 'STOPPED');
        assert.strictEqual(parsed.exitCode, 1);

        const reason = mapEcsEventToFailureReason(parsed.rawDetail, { timedOut: false });
        assert.strictEqual(reason, 'NONZERO_EXIT');
    });

    it('correctly maps OOM kill (exit code 137 / reason) to TASK_OOM', () => {
        const fixture = loadFixture('task-stopped-oom.json');
        const parsed = parseEcsEvent(fixture);

        assert.ok(parsed);
        assert.strictEqual(parsed.lastStatus, 'STOPPED');
        assert.strictEqual(parsed.exitCode, 137);

        const reason = mapEcsEventToFailureReason(parsed.rawDetail, { timedOut: false });
        assert.strictEqual(reason, 'TASK_OOM');
    });

    it('correctly maps task that failed to start (no container) to NONZERO_EXIT', () => {
        const fixture = loadFixture('task-stopped-start-failure.json');
        const parsed = parseEcsEvent(fixture);

        assert.ok(parsed);
        assert.strictEqual(parsed.lastStatus, 'STOPPED');
        assert.strictEqual(parsed.stopCode, 'TaskFailedToStart');
        assert.strictEqual(parsed.exitCode, null);

        const reason = mapEcsEventToFailureReason(parsed.rawDetail, { timedOut: false });
        assert.strictEqual(reason, 'NONZERO_EXIT');
    });

    it('prioritizes deployment.timedOut flag over container exit code / stopCode to map to TIMEOUT', () => {
        const fixture = loadFixture('task-stopped-watchdog-timeout.json');
        const parsed = parseEcsEvent(fixture);

        assert.ok(parsed);
        // Even if container exited 143 or anything else, timedOut flag must win
        const reason = mapEcsEventToFailureReason(parsed.rawDetail, { timedOut: true });
        assert.strictEqual(reason, 'TIMEOUT');
    });

    it('correctly parses RUNNING event timestamps', () => {
        const fixture = loadFixture('task-running.json');
        const parsed = parseEcsEvent(fixture);

        assert.ok(parsed);
        assert.strictEqual(parsed.lastStatus, 'RUNNING');
        assert.ok(parsed.startedAt instanceof Date);
    });
});

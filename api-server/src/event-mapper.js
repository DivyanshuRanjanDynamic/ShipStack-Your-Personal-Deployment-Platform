/**
 * Maps an ECS Task State Change event detail + Deployment record to a failure reason.
 * Evaluation order strictly follows PHASE1.md Section 9.4:
 * 1. Deployment timedOut = true -> TIMEOUT
 * 2. Container exit code 137 or OOM in stoppedReason / container reason -> TASK_OOM
 * 3. Container exit code non-zero -> NONZERO_EXIT
 * 4. Task stopped before any container started -> NONZERO_EXIT with stopCode
 * 5. Exit code 0 -> Not a failure here (null)
 */
function mapEcsEventToFailureReason(detail, deployment) {
    if (!detail) return null;

    // 1. Timeouts are identified by the timedOut database flag, NOT parsing text
    if (deployment && deployment.timedOut === true) {
        return 'TIMEOUT';
    }

    const container = Array.isArray(detail.containers) && detail.containers.length > 0
        ? detail.containers[0]
        : null;

    const exitCode = container && typeof container.exitCode === 'number'
        ? container.exitCode
        : null;

    const stoppedReason = detail.stoppedReason || '';
    const containerReason = container?.reason || '';

    // 2. OOM check: exit code 137, or OOM text in stoppedReason / container reason
    const isOomText = /OutOfMemory|OOM/i.test(stoppedReason) || /OutOfMemory|OOM/i.test(containerReason);
    if (exitCode === 137 || isOomText) {
        return 'TASK_OOM';
    }

    // 3. Container non-zero exit code
    if (exitCode !== null && exitCode !== 0) {
        return 'NONZERO_EXIT';
    }

    // 4. Task stopped before any container started (empty containers or no exitCode)
    if (exitCode === null) {
        return 'NONZERO_EXIT';
    }

    // 5. Exit code 0 -> not a failure here
    return null;
}

/**
 * Extracts essential fields from the raw ECS EventBridge event.
 */
function parseEcsEvent(rawEvent) {
    if (!rawEvent) return null;

    // Check detail-type
    const detailType = rawEvent['detail-type'];
    if (detailType !== 'ECS Task State Change') {
        return null;
    }

    const detail = rawEvent.detail;
    if (!detail || !detail.taskArn) {
        return null;
    }

    const container = Array.isArray(detail.containers) && detail.containers.length > 0
        ? detail.containers[0]
        : null;

    return {
        taskArn: detail.taskArn,
        lastStatus: detail.lastStatus,
        startedAt: detail.startedAt ? new Date(detail.startedAt) : null,
        stoppedAt: detail.stoppedAt ? new Date(detail.stoppedAt) : null,
        stopCode: detail.stopCode || null,
        stoppedReason: detail.stoppedReason || null,
        exitCode: container && typeof container.exitCode === 'number' ? container.exitCode : null,
        rawDetail: detail,
    };
}

module.exports = {
    mapEcsEventToFailureReason,
    parseEcsEvent,
};

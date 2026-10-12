const { StopTaskCommand } = require('@aws-sdk/client-ecs');

/**
 * Creates and starts the Watchdog background job enforcing build deadlines.
 *
 * Adheres strictly to spec §9.7:
 * - Runs every 30s.
 * - Atomic conditional update: updateMany({ where: { id: dep.id, timedOut: false }, data: { timedOut: true } }).
 *   Only caller whose update count === 1 calls StopTask.
 * - Stops tasks exceeding deadlineAt.
 * - Stops tasks exceeding PROVISIONING_DEADLINE_MINUTES that never reached RUNNING (startedAt === null).
 */
function createWatchdog({
    prisma,
    ecsClient,
    cluster = process.env.ECS_CLUSTER || 'builder-cluster',
    intervalMs = 30000,
    provisioningDeadlineMinutes = 10,
}) {
    let intervalId = null;
    let isRunning = false;

    async function checkDeadlinesOnce(now = new Date()) {
        try {
            // 1. Find in-progress deployments with deadlineAt < now and timedOut = false
            const expiredDeployments = await prisma.deployment.findMany({
                where: {
                    status: 'IN_PROGRESS',
                    timedOut: false,
                    deadlineAt: {
                        not: null,
                        lt: now,
                    },
                },
                select: { id: true, ecsTaskArn: true },
            });

            // 2. Find deployments stuck in provisioning (never reached RUNNING)
            const provisioningCutoff = new Date(now.getTime() - provisioningDeadlineMinutes * 60 * 1000);
            const stuckProvisioning = await prisma.deployment.findMany({
                where: {
                    status: { in: ['QUEUED', 'IN_PROGRESS'] },
                    startedAt: null,
                    timedOut: false,
                    createdAt: {
                        lt: provisioningCutoff,
                    },
                },
                select: { id: true, ecsTaskArn: true },
            });

            // Deduplicate across both queries
            const uniqueToStop = Array.from(new Map([...expiredDeployments, ...stuckProvisioning].map(d => [d.id, d])).values());

            for (const dep of uniqueToStop) {
                // Atomic conditional update ensures only 1 API instance proceeds
                const updateResult = await prisma.deployment.updateMany({
                    where: {
                        id: dep.id,
                        timedOut: false,
                    },
                    data: {
                        timedOut: true,
                    },
                });

                if (updateResult.count === 1) {
                    console.log(`[watchdog] Marked deployment ${dep.id} as timedOut=true`);
                    if (dep.ecsTaskArn && ecsClient) {
                        try {
                            const command = new StopTaskCommand({
                                cluster,
                                task: dep.ecsTaskArn,
                                reason: 'ShipStack build deadline exceeded',
                            });
                            await ecsClient.send(command);
                            console.log(`[watchdog] Called StopTask for taskArn: ${dep.ecsTaskArn}`);
                        } catch (err) {
                            console.error(`[watchdog] Error calling StopTask for ${dep.ecsTaskArn}:`, err.message);
                        }
                    } else if (!dep.ecsTaskArn) {
                        // No ECS task was ever started (no taskArn saved).
                        // Mark deployment as FAILURE so it does not stay in QUEUED/IN_PROGRESS and block future deployments.
                        await prisma.deployment.update({
                            where: { id: dep.id },
                            data: {
                                status: 'FAILURE',
                                stopCode: 'PROVISIONING_TIMEOUT',
                                stoppedReason: 'Task never started within provisioning deadline',
                            },
                        }).catch((err) => console.error(`[watchdog] Error setting FAILURE for ${dep.id}:`, err.message));
                    }
                }
            }
        } catch (err) {
            console.error('[watchdog] Error during deadline check cycle:', err.message);
        }
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        console.log(`[watchdog] Started watchdog service (interval: ${intervalMs}ms)`);
        intervalId = setInterval(() => {
            checkDeadlinesOnce().catch((err) => console.error('[watchdog] Uncaught cycle error:', err));
        }, intervalMs);
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        console.log('[watchdog] Stopped watchdog service');
    }

    return {
        start,
        stop,
        checkDeadlinesOnce,
    };
}

module.exports = {
    createWatchdog,
};

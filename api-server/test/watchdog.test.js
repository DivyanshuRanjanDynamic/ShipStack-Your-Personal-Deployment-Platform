const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createWatchdog } = require('../src/watchdog');

describe('Watchdog Service', () => {
    it('finds expired deployments, atomically sets timedOut=true, and calls StopTask', async () => {
        const stoppedTasks = [];
        const mockEcsClient = {
            send: async (command) => {
                stoppedTasks.push(command.input);
            }
        };

        const now = new Date('2026-10-10T12:00:00Z');
        const mockPrisma = {
            deployment: {
                findMany: async ({ where }) => {
                    // Expired query
                    if (where.deadlineAt) {
                        return [{ id: 'dep-expired-1', ecsTaskArn: 'arn:task-1' }];
                    }
                    // Stuck provisioning query
                    return [];
                },
                updateMany: async ({ where, data }) => {
                    if (where.id === 'dep-expired-1' && where.timedOut === false) {
                        return { count: 1 };
                    }
                    return { count: 0 };
                }
            }
        };

        const watchdog = createWatchdog({
            prisma: mockPrisma,
            ecsClient: mockEcsClient,
            cluster: 'builder-cluster',
            intervalMs: 1000,
        });

        await watchdog.checkDeadlinesOnce(now);

        assert.strictEqual(stoppedTasks.length, 1);
        assert.strictEqual(stoppedTasks[0].cluster, 'builder-cluster');
        assert.strictEqual(stoppedTasks[0].task, 'arn:task-1');
        assert.strictEqual(stoppedTasks[0].reason, 'ShipStack build deadline exceeded');
    });

    it('does not call StopTask if atomic update affected 0 rows (multi-instance race protection)', async () => {
        const stoppedTasks = [];
        const mockEcsClient = {
            send: async (command) => {
                stoppedTasks.push(command.input);
            }
        };

        const mockPrisma = {
            deployment: {
                findMany: async () => [{ id: 'dep-racing-1', ecsTaskArn: 'arn:task-racing' }],
                updateMany: async () => ({ count: 0 }), // Another instance already flipped it
            }
        };

        const watchdog = createWatchdog({
            prisma: mockPrisma,
            ecsClient: mockEcsClient,
        });

        await watchdog.checkDeadlinesOnce();

        assert.strictEqual(stoppedTasks.length, 0);
    });
});

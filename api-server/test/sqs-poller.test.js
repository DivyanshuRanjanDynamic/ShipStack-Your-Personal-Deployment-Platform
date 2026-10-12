const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createSqsPoller } = require('../src/sqs-poller');

function loadFixture(filename) {
    const filePath = path.join(__dirname, 'fixtures', 'ecs-events', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('SQS Poller Event Handler', () => {
    it('RUNNING event records startedAt and deadlineAt', async () => {
        const updates = [];
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-running-1',
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    startedAt: null,
                    status: 'QUEUED',
                }),
                update: async (args) => {
                    updates.push(args);
                }
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            queueUrl: 'https://sqs.eu-north-1.amazonaws.com/123456789012/shipstack-ecs-events',
            prisma: mockPrisma,
            buildDeadlineMinutes: 15,
        });

        const fixture = loadFixture('task-running.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, true);
        assert.strictEqual(result.action, 'running_recorded');
        assert.strictEqual(updates.length, 1);
        assert.ok(updates[0].data.startedAt);
        assert.ok(updates[0].data.deadlineAt);
    });

    it('STOPPED success event updates stop metadata and does not publish diagnosis', async () => {
        const published = [];
        const mockPublisher = async (payload) => { published.push(payload); };

        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-success-1',
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    status: 'IN_PROGRESS',
                    timedOut: false,
                }),
                update: async () => {}
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
            publishDiagnosisRequest: mockPublisher,
        });

        const fixture = loadFixture('task-stopped-success.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, true);
        assert.strictEqual(result.action, 'stopped_processed');
        assert.strictEqual(published.length, 0); // Not a failure
    });

    it('STOPPED failure event (nonzero exit) publishes diagnosis request', async () => {
        const published = [];
        const mockPublisher = async (payload) => { published.push(payload); };

        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-failed-1',
                    projectId: 'proj-1',
                    project: { gitUrl: 'https://github.com/my/repo' },
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    status: 'IN_PROGRESS',
                    timedOut: false,
                    diagnosis: null,
                }),
                update: async () => {}
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
            publishDiagnosisRequest: mockPublisher,
        });

        const fixture = loadFixture('task-stopped-nonzero-exit.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, true);
        assert.strictEqual(published.length, 1);
        assert.strictEqual(published[0].deploymentId, 'dep-failed-1');
        assert.strictEqual(published[0].failureReason, 'NONZERO_EXIT');
        assert.strictEqual(published[0].exitCode, 1);
    });

    it('STOPPED failure event with existing diagnosis drops duplicate', async () => {
        const published = [];
        const mockPublisher = async (payload) => { published.push(payload); };

        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-already-done-1',
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    status: 'FAILURE',
                    diagnosis: { id: 'diag-done', status: 'DONE' },
                }),
                update: async () => {}
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
            publishDiagnosisRequest: mockPublisher,
        });

        const fixture = loadFixture('task-stopped-nonzero-exit.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, true);
        assert.strictEqual(result.action, 'duplicate_dropped');
        assert.strictEqual(published.length, 0);
    });

    it('unmatched taskArn does not delete message (handled=false for SQS retry)', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => null, // Not yet saved in DB due to race
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
        });

        const fixture = loadFixture('task-stopped-nonzero-exit.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, false);
        assert.strictEqual(result.reason, 'unmatched_task_arn');
    });

    it('Kafka publish failure does not delete SQS message (handled=false for retry)', async () => {
        const mockPublisher = async () => ({ error: 'Kafka connection timeout' });

        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-kafka-fail-1',
                    projectId: 'proj-1',
                    project: { gitUrl: 'https://github.com/my/repo' },
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    status: 'IN_PROGRESS',
                    timedOut: false,
                    diagnosis: null,
                }),
                update: async () => {}
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
            publishDiagnosisRequest: mockPublisher,
        });

        const fixture = loadFixture('task-stopped-nonzero-exit.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, false);
        assert.strictEqual(result.reason, 'kafka_publish_failed');
    });

    it('STOPPED failure event for deployment already in terminal FAILURE drops duplicate (handled=true)', async () => {
        const published = [];
        const mockPublisher = async (payload) => { published.push(payload); };

        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-already-failed-by-layer-a',
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    status: 'FAILURE', // Layer A already marked it
                    timedOut: false,
                    diagnosis: null,
                }),
                update: async () => {}
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
            publishDiagnosisRequest: mockPublisher,
        });

        const fixture = loadFixture('task-stopped-nonzero-exit.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, true);
        assert.strictEqual(result.action, 'already_terminal_dropped');
        assert.strictEqual(published.length, 0);
    });

    it('DB update failure during RUNNING returns handled=false for retry', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-running-err',
                    ecsTaskArn: 'arn:aws:ecs:eu-north-1:123456789012:task/builder-cluster/730684f68e2b44c1940b91cad310d6fb',
                    startedAt: null,
                    status: 'QUEUED',
                }),
                update: async () => {
                    throw new Error('Connection pool exhausted');
                }
            }
        };

        const poller = createSqsPoller({
            sqsClient: {},
            prisma: mockPrisma,
        });

        const fixture = loadFixture('task-running.json');
        const result = await poller.handleEvent(fixture);

        assert.strictEqual(result.handled, false);
        assert.strictEqual(result.reason, 'db_update_failed');
    });

    it('unrecognized non-ECS event does not delete message (handled=false for DLQ)', async () => {
        const poller = createSqsPoller({
            sqsClient: {},
            prisma: {},
        });

        const result = await poller.handleEvent({ random: 'payload' });
        assert.strictEqual(result.handled, false);
        assert.strictEqual(result.reason, 'unrecognized_event');
    });
});

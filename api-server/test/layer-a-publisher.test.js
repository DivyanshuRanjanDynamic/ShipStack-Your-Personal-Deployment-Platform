const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createDiagnosisPublisher, DiagnosisRequestSchema } = require('../src/publisher');

describe('Layer A Diagnosis Publisher', () => {
    it('successfully publishes a valid diagnosis request when no diagnosis exists', async () => {
        const sentMessages = [];
        const mockProducer = {
            send: async ({ topic, messages }) => {
                sentMessages.push({ topic, messages });
            }
        };

        const mockPrisma = {
            diagnosis: {
                findUnique: async () => null,
            },
            deployment: {
                findUnique: async () => ({
                    id: 'dep-layer-a-1',
                    projectId: 'proj-123',
                    project: { gitUrl: 'https://github.com/myorg/myrepo' }
                })
            }
        };

        const publisher = createDiagnosisPublisher(mockPrisma, mockProducer, 'diagnosis-requests');

        const result = await publisher({
            deploymentId: 'dep-layer-a-1',
            projectId: 'proj-123',
            gitUrl: 'https://github.com/myorg/myrepo',
            failedStep: 'clone',
            exitCode: 1,
            failureReason: 'NONZERO_EXIT',
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.payload);
        assert.strictEqual(result.payload.deployment_id, 'dep-layer-a-1');
        assert.strictEqual(result.payload.failed_step, 'clone');
        assert.strictEqual(result.payload.failure_reason, 'NONZERO_EXIT');
        assert.strictEqual(result.payload.context_s3_key, '__meta/dep-layer-a-1/build-context.json');
        assert.strictEqual(result.payload.user_id, null);

        // Verify sent message on Kafka
        assert.strictEqual(sentMessages.length, 1);
        assert.strictEqual(sentMessages[0].topic, 'diagnosis-requests');
        assert.strictEqual(sentMessages[0].messages[0].key, 'dep-layer-a-1');
        const parsedMessage = JSON.parse(sentMessages[0].messages[0].value);
        assert.strictEqual(parsedMessage.deployment_id, 'dep-layer-a-1');
    });

    it('skips publishing if a diagnosis row already exists', async () => {
        const sentMessages = [];
        const mockProducer = {
            send: async () => { sentMessages.push(true); }
        };

        const mockPrisma = {
            diagnosis: {
                findUnique: async () => ({ id: 'diag-existing', status: 'DONE' }),
            }
        };

        const publisher = createDiagnosisPublisher(mockPrisma, mockProducer);

        const result = await publisher({
            deploymentId: 'dep-already-diagnosed',
            projectId: 'proj-123',
            gitUrl: 'https://github.com/myorg/myrepo',
        });

        assert.strictEqual(result.skipped, true);
        assert.strictEqual(result.reason, 'diagnosis_exists');
        assert.strictEqual(sentMessages.length, 0);
    });

    it('does not throw when Kafka producer send fails (non-blocking resilience)', async () => {
        const mockProducer = {
            send: async () => {
                throw new Error('Kafka connection timeout');
            }
        };

        const mockPrisma = {
            diagnosis: {
                findUnique: async () => null,
            }
        };

        const publisher = createDiagnosisPublisher(mockPrisma, mockProducer);

        const result = await publisher({
            deploymentId: 'dep-kafka-down',
            projectId: 'proj-123',
            gitUrl: 'https://github.com/myorg/myrepo',
        });

        assert.ok(result.error);
        assert.strictEqual(result.error, 'Kafka connection timeout');
    });

    it('validates schema contract fields correctly', () => {
        const validPayload = {
            deployment_id: 'dep-valid-1',
            project_id: 'proj-1',
            user_id: null,
            git_url: 'https://github.com/org/repo',
            failed_step: 'build',
            exit_code: 137,
            failure_reason: 'TASK_OOM',
            context_s3_key: '__meta/dep-valid-1/build-context.json',
            failed_at: new Date().toISOString(),
            stop_code: 'EssentialContainerExited',
            stopped_reason: 'OutOfMemory',
        };

        assert.doesNotThrow(() => DiagnosisRequestSchema.parse(validPayload));
    });
});

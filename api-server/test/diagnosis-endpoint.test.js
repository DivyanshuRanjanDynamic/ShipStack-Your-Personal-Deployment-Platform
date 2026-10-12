const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createDiagnosisHandler, DiagnosisResponseSchema } = require('../routes/diagnosis');

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        setHeader(name, value) {
            this.headers[name] = value;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

describe('GET /deployments/:id/diagnosis', () => {
    it('returns 404 when deployment is not found', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => null,
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'non-existent' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 404);
        assert.deepStrictEqual(res.body, { error: 'Deployment not found' });
        assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    });

    it('returns 200 NOT_APPLICABLE when deployment status is not FAILURE (e.g. SUCCESS)', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-1',
                    status: 'SUCCESS',
                    diagnosis: null,
                }),
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'dep-1' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { status: 'NOT_APPLICABLE' });
        assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    });

    it('returns 200 NOT_APPLICABLE when deployment status is IN_PROGRESS', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-2',
                    status: 'IN_PROGRESS',
                    diagnosis: null,
                }),
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'dep-2' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { status: 'NOT_APPLICABLE' });
    });

    it('returns 200 PENDING when deployment failed but no diagnosis row exists', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-3',
                    status: 'FAILURE',
                    diagnosis: null,
                }),
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'dep-3' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { status: 'PENDING' });
        assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    });

    it('returns 200 PENDING when diagnosis row status is PENDING', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-4',
                    status: 'FAILURE',
                    diagnosis: {
                        id: 'diag-1',
                        status: 'PENDING',
                    },
                }),
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'dep-4' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { status: 'PENDING' });
    });

    it('returns 200 DONE with validated diagnosis payload and no internal fields', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-5',
                    status: 'FAILURE',
                    diagnosis: {
                        id: 'diag-2',
                        status: 'DONE',
                        category: 'NODE_VERSION_MISMATCH',
                        confidence: 0.85,
                        rootCause: 'Node version 16 used, requires >= 18',
                        fixJson: {
                            fix_steps: [
                                { step: 'Upgrade Node to 18 in package.json', type: 'config' }
                            ],
                            evidence: [
                                { line: 42, text: 'ERR! Unsupported engine: node 16' }
                            ]
                        },
                        source: 'STUB',
                        // Internal fields that MUST NOT leak:
                        tokensIn: 500,
                        tokensOut: 120,
                        latencyMs: 1400,
                        signatureHash: 'hash_abc123',
                        model: 'gemini-1.5-pro',
                        feedback: 1,
                    },
                }),
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'dep-5' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['Cache-Control'], 'no-store');
        assert.strictEqual(res.body.status, 'DONE');
        assert.deepStrictEqual(res.body.diagnosis, {
            category: 'NODE_VERSION_MISMATCH',
            confidence: 0.85,
            root_cause: 'Node version 16 used, requires >= 18',
            fix_steps: [
                { step: 'Upgrade Node to 18 in package.json', type: 'config' }
            ],
            evidence: [
                { line: 42, text: 'ERR! Unsupported engine: node 16' }
            ],
            source: 'STUB'
        });

        // Ensure internal fields are stripped
        assert.strictEqual(res.body.tokensIn, undefined);
        assert.strictEqual(res.body.diagnosis.tokensIn, undefined);
        assert.strictEqual(res.body.diagnosis.signatureHash, undefined);
        assert.strictEqual(res.body.diagnosis.model, undefined);

        // Schema validation check
        assert.doesNotThrow(() => DiagnosisResponseSchema.parse(res.body));
    });

    it('returns 200 FAILED with user-safe message when diagnosis status is FAILED', async () => {
        const mockPrisma = {
            deployment: {
                findUnique: async () => ({
                    id: 'dep-6',
                    status: 'FAILURE',
                    diagnosis: {
                        id: 'diag-3',
                        status: 'FAILED',
                    },
                }),
            }
        };
        const handler = createDiagnosisHandler(mockPrisma);
        const req = { params: { id: 'dep-6' } };
        const res = createMockRes();

        await handler(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['Cache-Control'], 'no-store');
        assert.strictEqual(res.body.status, 'FAILED');
        assert.strictEqual(typeof res.body.error, 'string');
        assert.ok(res.body.error.length > 0);

        // Schema validation check
        assert.doesNotThrow(() => DiagnosisResponseSchema.parse(res.body));
    });
});

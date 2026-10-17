const express = require('express');
const { z } = require('zod');

const FixStepSchema = z.object({
    step: z.string().min(1),
    type: z.enum(['config', 'code', 'env', 'none']),
});

const EvidenceSchema = z.object({
    line: z.number().int().positive(),
    text: z.string().min(1),
});

const DiagnosisPayloadSchema = z.object({
    category: z.string().min(1),
    confidence: z.number().min(0).max(1),
    root_cause: z.string().min(1),
    fix_steps: z.array(FixStepSchema),
    evidence: z.array(EvidenceSchema),
    source: z.enum(['STUB', 'RULES', 'LLM', 'LLM_FALLBACK', 'CACHE']),
    needs_human: z.boolean().optional(),
});

const DiagnosisResponseSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('NOT_APPLICABLE'),
    }),
    z.object({
        status: z.literal('PENDING'),
    }),
    z.object({
        status: z.literal('DONE'),
        diagnosis: DiagnosisPayloadSchema,
    }),
    z.object({
        status: z.literal('FAILED'),
        error: z.string().min(1),
    }),
]);

function createDiagnosisHandler(prisma) {
    return async function getDiagnosis(req, res) {
        const { id } = req.params;
        res.setHeader('Cache-Control', 'no-store');

        try {
            const deployment = await prisma.deployment.findUnique({
                where: { id },
                include: { diagnosis: true }
            });

            if (!deployment) {
                return res.status(404).json({ error: 'Deployment not found' });
            }

            // Deployment not failed -> NOT_APPLICABLE
            if (deployment.status !== 'FAILURE') {
                const response = { status: 'NOT_APPLICABLE' };
                DiagnosisResponseSchema.parse(response);
                return res.json(response);
            }

            const diagnosis = deployment.diagnosis;

            // Failed, no diagnosis row yet, or diagnosis is PENDING
            if (!diagnosis || diagnosis.status === 'PENDING') {
                const response = { status: 'PENDING' };
                DiagnosisResponseSchema.parse(response);
                return res.json(response);
            }

            // Diagnosis complete -> DONE
            if (diagnosis.status === 'DONE') {
                const fixJson = typeof diagnosis.fixJson === 'object' && diagnosis.fixJson !== null
                    ? diagnosis.fixJson
                    : {};

                const diagnosisData = {
                    category: diagnosis.category || 'UNKNOWN',
                    confidence: typeof diagnosis.confidence === 'number' ? diagnosis.confidence : 0,
                    root_cause: diagnosis.rootCause || 'No root cause specified',
                    fix_steps: Array.isArray(fixJson.fix_steps) ? fixJson.fix_steps : [],
                    evidence: Array.isArray(fixJson.evidence) ? fixJson.evidence : [],
                    source: diagnosis.source || 'STUB',
                    needs_human: diagnosis.needsHuman ?? fixJson.needs_human ?? false,
                };

                const response = {
                    status: 'DONE',
                    diagnosis: diagnosisData
                };

                // Validate with zod before sending (strips or flags internal fields)
                const validated = DiagnosisResponseSchema.parse(response);
                return res.json(validated);
            }

            // Diagnosis errored -> FAILED
            if (diagnosis.status === 'FAILED') {
                const response = {
                    status: 'FAILED',
                    error: 'Diagnosis generation failed. Please inspect build logs manually.'
                };
                const validated = DiagnosisResponseSchema.parse(response);
                return res.json(validated);
            }

            // Fallback for any unexpected diagnosis status
            return res.json({ status: 'PENDING' });
        } catch (err) {
            console.error('Error fetching diagnosis:', err);
            // M6 audit fix: don't expose internal error details to clients
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}

function createDiagnosisRouter(prisma) {
    const router = express.Router();
    const handler = createDiagnosisHandler(prisma);
    router.get('/deployments/:id/diagnosis', handler);
    router.get('/deployment/:id/diagnosis', handler);
    return router;
}

module.exports = {
    createDiagnosisRouter,
    createDiagnosisHandler,
    DiagnosisResponseSchema,
    DiagnosisPayloadSchema,
    FixStepSchema,
    EvidenceSchema,
};

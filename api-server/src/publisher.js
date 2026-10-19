const { z } = require('zod');

const BuildStepEnum = z.enum(['clone', 'install', 'build', 'upload']);
const FailureReasonEnum = z.enum([
    'TASK_OOM',
    'TIMEOUT',
    'NONZERO_EXIT',
    'UPLOAD_EMPTY',
    'CLONE_FAILED',
    'UNSUPPORTED_PROJECT',
    'UPLOAD_FAILED',
    'MISSING_BUILD_SCRIPT',
    'ROOT_DIR_AMBIGUOUS',
]);

const DiagnosisRequestSchema = z.object({
    deployment_id: z.string().min(1),
    project_id: z.string().min(1),
    user_id: z.string().nullable(),
    git_url: z.string().url(),
    failed_step: BuildStepEnum,
    exit_code: z.number().int(),
    failure_reason: FailureReasonEnum,
    context_s3_key: z.string().min(1),
    failed_at: z.string().datetime(),
    stop_code: z.string().nullable().optional(),
    stopped_reason: z.string().nullable().optional(),
});

function createDiagnosisPublisher(prisma, kafkaProducer, topicName = process.env.DIAGNOSIS_TOPIC || 'diagnosis-requests') {
    return async function publishDiagnosisRequest({
        deploymentId,
        projectId,
        gitUrl,
        userId = null,
        failedStep = 'clone',
        exitCode = 1,
        failureReason = 'NONZERO_EXIT',
        stopCode = null,
        stoppedReason = null,
    }) {
        try {
            // Rule: Publish only if no Diagnosis row exists for the deployment
            const existingDiagnosis = await prisma.diagnosis.findUnique({
                where: { deploymentId },
            });
            if (existingDiagnosis) {
                console.log(`[publisher] Diagnosis row already exists for deployment ${deploymentId}, skipping publish`);
                return { skipped: true, reason: 'diagnosis_exists' };
            }

            let finalGitUrl = gitUrl;
            let finalProjectId = projectId;

            if (!finalGitUrl || !finalProjectId) {
                const dep = await prisma.deployment.findUnique({
                    where: { id: deploymentId },
                    include: { project: true },
                });
                if (dep) {
                    finalProjectId = finalProjectId || dep.projectId;
                    finalGitUrl = finalGitUrl || dep.project?.gitUrl;
                }
            }

            if (!finalGitUrl) {
                finalGitUrl = 'https://github.com/placeholder/repo';
            }

            const validStep = ['clone', 'install', 'build', 'upload'].includes(failedStep)
                ? failedStep
                : 'clone';

            const validReason = FailureReasonEnum.options.includes(failureReason)
                ? failureReason
                : 'NONZERO_EXIT';

            const payload = {
                deployment_id: deploymentId,
                project_id: finalProjectId || 'unknown_project',
                user_id: userId || null,
                git_url: finalGitUrl,
                failed_step: validStep,
                exit_code: typeof exitCode === 'number' ? Math.round(exitCode) : 1,
                failure_reason: validReason,
                context_s3_key: `__meta/${deploymentId}/build-context.json`,
                failed_at: new Date().toISOString(),
                stop_code: stopCode || null,
                stopped_reason: stoppedReason || null,
            };

            const validated = DiagnosisRequestSchema.parse(payload);

            if (kafkaProducer && typeof kafkaProducer.send === 'function') {
                await kafkaProducer.send({
                    topic: topicName,
                    messages: [
                        {
                            key: validated.deployment_id,
                            value: JSON.stringify(validated),
                        },
                    ],
                });
                console.log(`[publisher] Published diagnosis-request for ${deploymentId} on topic ${topicName}`);
            }

            return { success: true, payload: validated };
        } catch (err) {
            console.error(`[publisher] Failed to publish diagnosis request for ${deploymentId}:`, err.message);
            return { error: err.message };
        }
    };
}

module.exports = {
    createDiagnosisPublisher,
    DiagnosisRequestSchema,
};

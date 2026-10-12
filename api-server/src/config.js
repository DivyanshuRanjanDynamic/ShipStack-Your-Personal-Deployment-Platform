const { z } = require('zod');

const ConfigSchema = z.object({
    AWS_REGION: z.string().default('eu-north-1'),
    SQS_QUEUE_URL: z.string().url().optional(),
    BUILD_DEADLINE_MINUTES: z.coerce.number().int().positive().default(15),
    PROVISIONING_DEADLINE_MINUTES: z.coerce.number().int().positive().default(10),
    MAX_DIAGNOSES_PER_DAY: z.coerce.number().int().positive().default(500),
    DIAGNOSIS_TOPIC: z.string().default('diagnosis-requests'),
    ECS_CLUSTER: z.string().default('builder-cluster'),
});

function loadConfig(env = process.env) {
    const result = ConfigSchema.safeParse(env);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => ` - ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(`api-server configuration validation failed:\n${issues}`);
    }
    return result.data;
}

module.exports = {
    loadConfig,
    ConfigSchema,
    config: loadConfig(),
};

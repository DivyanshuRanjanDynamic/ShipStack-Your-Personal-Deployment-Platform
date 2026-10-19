const { z } = require('zod');

// Node majors installed in the build image (Step 3). Overridable via env for forward-compat.
const INSTALLED_NODE_MAJORS = (process.env.INSTALLED_NODE_MAJORS || '16,18,20,22')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// A relative path that stays inside the repo/project: no absolute paths, no "..", length-capped.
const relativePath = (max) =>
    z.string()
        .trim()
        .min(1)
        .max(max)
        .refine((v) => !/^([a-zA-Z]:)?[\\/]/.test(v), { message: 'must be a relative path' })
        .refine((v) => !v.split(/[\\/]/).includes('..'), { message: 'must not contain ".."' });

const command = z.string().trim().min(1).max(500);

// All settings are optional; null/omitted means auto-detect. Unknown keys are stripped.
const BuildSettingsSchema = z.object({
    rootDirectory: relativePath(200).nullish(),
    installCommand: command.nullish(),
    buildCommand: command.nullish(),
    outputDirectory: relativePath(200).nullish(),
    nodeVersion: z.enum(INSTALLED_NODE_MAJORS).nullish(),
});

const SETTING_TO_ENV = {
    rootDirectory: 'BUILD_ROOT_DIR',
    installCommand: 'BUILD_INSTALL_CMD',
    buildCommand: 'BUILD_CMD',
    outputDirectory: 'BUILD_OUTPUT_DIR',
    nodeVersion: 'NODE_VERSION',
};

/**
 * Validates an incoming build-settings object. Returns { ok: true, settings } with only the
 * known keys (null when absent), or { ok: false, error } with a readable message.
 */
function parseBuildSettings(input) {
    if (input == null) {
        return { ok: true, settings: { rootDirectory: null, installCommand: null, buildCommand: null, outputDirectory: null, nodeVersion: null } };
    }
    const result = BuildSettingsSchema.safeParse(input);
    if (!result.success) {
        return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.') || 'buildSettings'}: ${i.message}`).join('; ') };
    }
    const d = result.data;
    return {
        ok: true,
        settings: {
            rootDirectory: d.rootDirectory ?? null,
            installCommand: d.installCommand ?? null,
            buildCommand: d.buildCommand ?? null,
            outputDirectory: d.outputDirectory ?? null,
            nodeVersion: d.nodeVersion ?? null,
        },
    };
}

/**
 * Builds the RunTask environment overrides for a project's stored settings.
 * Only non-null settings are emitted, each as its BUILD_* / NODE_VERSION variable.
 */
function buildSettingsEnv(project) {
    const env = [];
    for (const [key, name] of Object.entries(SETTING_TO_ENV)) {
        const value = project ? project[key] : null;
        if (value != null && String(value) !== '') {
            env.push({ name, value: String(value) });
        }
    }
    return env;
}

module.exports = { parseBuildSettings, buildSettingsEnv, BuildSettingsSchema, SETTING_TO_ENV, INSTALLED_NODE_MAJORS };

// ECS container overrides are capped (~8 KB total); keep user env well under it.
const MAX_USER_ENV_BYTES = 6 * 1024;

/**
 * Serializes a project's env vars into the single USER_ENV_JSON value the build-server reads.
 * Accepts the stored [{ key, value }] array (or a plain object) and produces a JSON object of
 * string values. Returns { json, bytes, count, tooLarge }.
 */
function buildUserEnvJson(envVars) {
    const obj = {};
    if (Array.isArray(envVars)) {
        for (const entry of envVars) {
            if (entry && entry.key) obj[String(entry.key)] = String(entry.value ?? '');
        }
    } else if (envVars && typeof envVars === 'object') {
        for (const [key, value] of Object.entries(envVars)) {
            obj[String(key)] = String(value ?? '');
        }
    }
    const json = JSON.stringify(obj);
    const bytes = Buffer.byteLength(json);
    return { json, bytes, count: Object.keys(obj).length, tooLarge: bytes > MAX_USER_ENV_BYTES };
}

module.exports = { buildUserEnvJson, MAX_USER_ENV_BYTES };

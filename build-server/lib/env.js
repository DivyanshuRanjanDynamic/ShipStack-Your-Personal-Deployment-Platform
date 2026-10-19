const path = require('path');
const { appendNodeOption } = require('./node-version');

// Only these base variables are copied from the task environment into the child; COREPACK_*
// is also copied (set by the image). Everything else — ECS_*, KAFKA_*, any future platform
// secret — is left out by construction, never blocked by name.
const ALLOWLIST_BASE = ['PATH', 'HOME', 'LANG', 'TMPDIR'];

// User env vars may not set these: they are owned by the build. NODE_OPTIONS is handled
// specially (a user value is kept and the legacy flag appended), not placed directly.
const RESERVED_KEYS = new Set(['PATH', 'HOME', 'LANG', 'TMPDIR', 'NODE_OPTIONS']);
const ENV_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const DEFAULT_MAX_BYTES = 6 * 1024;
const DEFAULT_MAX_VARS = 100;

function isReserved(key) {
    return RESERVED_KEYS.has(key) || key.startsWith('COREPACK_');
}

/**
 * Parses and validates USER_ENV_JSON: a JSON object of string values, within size and count
 * limits. Returns { accepted, rejected: [{ key, reason }], error }. Values are never logged.
 */
function parseUserEnvJson(raw, { maxBytes = DEFAULT_MAX_BYTES, maxVars = DEFAULT_MAX_VARS } = {}) {
    if (raw == null || String(raw).trim() === '') {
        return { accepted: {}, rejected: [], error: null };
    }
    if (Buffer.byteLength(String(raw)) > maxBytes) {
        return { accepted: {}, rejected: [], error: `USER_ENV_JSON exceeds ${maxBytes} bytes` };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { accepted: {}, rejected: [], error: 'USER_ENV_JSON is not valid JSON' };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { accepted: {}, rejected: [], error: 'USER_ENV_JSON must be a JSON object' };
    }
    const entries = Object.entries(parsed);
    if (entries.length > maxVars) {
        return { accepted: {}, rejected: [], error: `USER_ENV_JSON has more than ${maxVars} variables` };
    }

    const accepted = {};
    const rejected = [];
    for (const [key, value] of entries) {
        if (!ENV_NAME_REGEX.test(key)) {
            rejected.push({ key, reason: 'invalid name' });
        } else if (typeof value !== 'string') {
            rejected.push({ key, reason: 'value is not a string' });
        } else {
            accepted[key] = value;
        }
    }
    return { accepted, rejected, error: null };
}

/**
 * Builds the child environment for install and build from an allowlist, never a spread of the
 * task environment. Platform secrets are absent because they are never copied. User vars are
 * applied except reserved ones; PATH (with the selected Node first) and NODE_OPTIONS (user
 * value plus the legacy flag when needed) are computed last.
 *
 * Returns { env, appliedKeys, rejectedReservedKeys }.
 */
function buildChildEnv({ baseEnv = process.env, nodeBinDir = null, legacyOpenSSL = false, userEnv = {} }) {
    const env = {};
    for (const key of ALLOWLIST_BASE) {
        if (baseEnv[key] !== undefined) env[key] = baseEnv[key];
    }
    for (const key of Object.keys(baseEnv)) {
        if (key.startsWith('COREPACK_')) env[key] = baseEnv[key];
    }

    const appliedKeys = [];
    const rejectedReservedKeys = [];
    let userNodeOptions = '';
    for (const [key, value] of Object.entries(userEnv)) {
        if (key === 'NODE_OPTIONS') {
            userNodeOptions = value;
            appliedKeys.push(key);
        } else if (isReserved(key)) {
            rejectedReservedKeys.push(key);
        } else {
            env[key] = value;
            appliedKeys.push(key);
        }
    }

    const basePath = baseEnv.PATH || '';
    env.PATH = nodeBinDir ? `${nodeBinDir}${path.delimiter}${basePath}` : basePath;

    let nodeOptions = userNodeOptions || '';
    if (legacyOpenSSL) nodeOptions = appendNodeOption(nodeOptions, '--openssl-legacy-provider');
    if (nodeOptions) env.NODE_OPTIONS = nodeOptions;
    else delete env.NODE_OPTIONS;

    return { env, appliedKeys: appliedKeys.sort(), rejectedReservedKeys: rejectedReservedKeys.sort() };
}

module.exports = {
    ALLOWLIST_BASE,
    RESERVED_KEYS,
    parseUserEnvJson,
    buildChildEnv,
};

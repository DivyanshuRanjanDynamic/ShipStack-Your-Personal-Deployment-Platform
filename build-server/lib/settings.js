// The build-server does not trust its environment: it re-validates the BUILD_* / NODE_VERSION
// settings the API sent, with the same rules (path containment, length caps). Invalid values are
// ignored (auto-detect) with a log line, never applied.

const MAX_PATH = 200;
const MAX_CMD = 500;
const MAX_NODE_VERSION = 20;

function validRelativePath(value, max) {
    const text = String(value).trim();
    if (text === '' || text.length > max) return null;
    if (/^([a-zA-Z]:)?[\\/]/.test(text)) return null; // absolute path
    if (text.split(/[\\/]/).includes('..')) return null;
    return text;
}

function validCommand(value) {
    const text = String(value).trim();
    if (text === '' || text.length > MAX_CMD) return null;
    return text;
}

function validNodeVersion(value) {
    const text = String(value).trim();
    if (text === '' || text.length > MAX_NODE_VERSION) return null;
    return text;
}

const CHECKS = [
    ['BUILD_ROOT_DIR', 'rootDirectory', (v) => validRelativePath(v, MAX_PATH), 'root directory'],
    ['BUILD_INSTALL_CMD', 'installCommand', validCommand, 'install command'],
    ['BUILD_CMD', 'buildCommand', validCommand, 'build command'],
    ['BUILD_OUTPUT_DIR', 'outputDirectory', (v) => validRelativePath(v, MAX_PATH), 'output directory'],
    ['NODE_VERSION', 'nodeVersion', validNodeVersion, 'node version'],
];

/**
 * Reads and re-validates the project build settings from the environment.
 * Returns { settings, logLines }; settings values are null when absent or invalid.
 */
function readBuildSettings(env = process.env) {
    const settings = { rootDirectory: null, installCommand: null, buildCommand: null, outputDirectory: null, nodeVersion: null };
    const logLines = [];
    for (const [envName, key, validator, label] of CHECKS) {
        const raw = env[envName];
        if (raw == null || String(raw).trim() === '') continue;
        const value = validator(raw);
        if (value === null) {
            logLines.push(`[setup] ignoring ${label} setting (invalid)`);
        } else {
            settings[key] = value;
            logLines.push(`[setup] applied ${label} setting: ${value}`);
        }
    }
    return { settings, logLines };
}

module.exports = { readBuildSettings };

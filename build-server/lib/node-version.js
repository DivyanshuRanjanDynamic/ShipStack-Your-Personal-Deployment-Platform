const fs = require('fs');
const path = require('path');
const semver = require('semver');

// Written into the image at build time: [{ major, version, binDir }], sorted ascending.
const INSTALLED_VERSIONS_PATH = '/opt/node/versions.json';

/**
 * Node majors installed in the image. Falls back to the running Node (so unit tests and a
 * plain host work) when the image manifest is absent.
 */
function readInstalledVersions() {
    try {
        const list = JSON.parse(fs.readFileSync(INSTALLED_VERSIONS_PATH, 'utf8'));
        if (Array.isArray(list) && list.length > 0) {
            return list
                .map((v) => ({ major: Number(v.major), version: v.version, binDir: v.binDir || v.bin }))
                .sort((a, b) => a.major - b.major);
        }
    } catch { /* fall through to the running Node */ }
    return [{ major: Number(process.versions.node.split('.')[0]), version: process.versions.node, binDir: path.dirname(process.execPath) }];
}

// Major from a .nvmrc / .node-version / setting value: "18", "v18", "18.20.5", "lts/*" (→ null).
function parseRequestedMajor(value) {
    const text = String(value).trim();
    const match = text.match(/^v?(\d+)(?:\.\d+)*$/);
    return match ? Number(match[1]) : null;
}

function pick(entry, source, warning = null) {
    return { major: entry.major, version: entry.version, binDir: entry.binDir, source, warning };
}

// Resolve an explicitly requested major (setting or .nvmrc) to an installed one.
function resolveMajor(installed, major, source) {
    const exact = installed.find((v) => v.major === major);
    if (exact) return pick(exact, source);
    const oldest = installed[0];
    const newest = installed[installed.length - 1];
    if (major < oldest.major) {
        return pick(oldest, source, `requested Node ${major} is not installed; using the oldest installed Node ${oldest.major}`);
    }
    if (major > newest.major) {
        return pick(newest, source, `requested Node ${major} is not installed; using the newest installed Node ${newest.major}`);
    }
    // An odd major between installed ones (17, 19, 21): use the highest installed below it.
    const lower = [...installed].reverse().find((v) => v.major <= major);
    return pick(lower, source, `requested Node ${major} is not installed; using Node ${lower.major}`);
}

// Resolve an engines.node range: highest installed major that satisfies it.
function resolveEngines(installed, range, defaultEntry) {
    const satisfying = [...installed].reverse().find((v) => semver.satisfies(v.version, range, { loose: true, includePrerelease: false }));
    if (satisfying) return pick(satisfying, `engines.node "${range}"`);

    const oldest = installed[0];
    if (semver.validRange(range, { loose: true }) && semver.gtr(oldest.version, range, { loose: true })) {
        // The whole range is below the oldest installed Node.
        return pick(oldest, `engines.node "${range}"`, `engines.node "${range}" requests a Node older than any installed; using the oldest installed Node ${oldest.major}`);
    }
    const warning = semver.validRange(range, { loose: true })
        ? `engines.node "${range}" matches no installed Node; using the default Node ${defaultEntry.major}`
        : `engines.node "${range}" is not a valid version range; using the default Node ${defaultEntry.major}`;
    return pick(defaultEntry, 'default', warning);
}

/**
 * Chooses the Node version for install and build.
 * Order: NODE_VERSION setting, .nvmrc / .node-version, engines.node, then the default.
 * Returns { major, version, binDir, source, warning }.
 */
function selectNodeVersion({ installed, defaultMajor, setting = null, nvmrc = null, engines = null }) {
    const sorted = [...installed].sort((a, b) => a.major - b.major);
    const defaultEntry = sorted.find((v) => v.major === defaultMajor) || sorted[sorted.length - 1];

    if (setting != null && String(setting).trim() !== '') {
        const major = parseRequestedMajor(setting);
        if (major != null) return resolveMajor(sorted, major, `NODE_VERSION setting "${String(setting).trim()}"`);
    }

    if (nvmrc != null && String(nvmrc).trim() !== '') {
        const major = parseRequestedMajor(nvmrc);
        if (major != null) return resolveMajor(sorted, major, '.nvmrc / .node-version');
        return pick(defaultEntry, 'default', `could not parse the requested Node version "${String(nvmrc).trim()}"; using the default Node ${defaultEntry.major}`);
    }

    if (engines != null && String(engines).trim() !== '') {
        return resolveEngines(sorted, String(engines).trim(), defaultEntry);
    }

    return pick(defaultEntry, 'default');
}

/**
 * Reads .nvmrc / .node-version and engines.node for a project, then selects a Node version.
 */
function selectNodeForProject({ projectDir, pkg, setting = null, installed = readInstalledVersions(), defaultMajor = Number(process.versions.node.split('.')[0]) }) {
    let nvmrc = null;
    for (const name of ['.nvmrc', '.node-version']) {
        const file = path.join(projectDir, name);
        if (fs.existsSync(file)) {
            try { nvmrc = fs.readFileSync(file, 'utf8'); } catch { /* ignore */ }
            if (nvmrc && nvmrc.trim() !== '') break;
        }
    }
    const engines = pkg && pkg.engines && pkg.engines.node ? pkg.engines.node : null;
    return selectNodeVersion({ installed, defaultMajor, setting, nvmrc, engines });
}

function dependencyMajor(range) {
    if (!range) return null;
    const coerced = semver.coerce(range);
    return coerced ? coerced.major : null;
}

/**
 * Webpack 4 (directly, or via react-scripts < 5) needs the legacy OpenSSL provider on Node 17+.
 */
function needsLegacyOpenSSL({ major, pkg }) {
    if (major < 17) return false;
    const deps = { ...((pkg && pkg.dependencies) || {}), ...((pkg && pkg.devDependencies) || {}) };
    const reactScripts = dependencyMajor(deps['react-scripts']);
    if (reactScripts != null && reactScripts < 5) return true;
    return dependencyMajor(deps['webpack']) === 4;
}

// Appends a flag to a NODE_OPTIONS string without overwriting what the user set.
function appendNodeOption(existing, flag) {
    const current = String(existing || '').trim();
    if (current.split(/\s+/).filter(Boolean).includes(flag)) return current;
    return current ? `${current} ${flag}` : flag;
}

// Log lines for the Node decision.
function describeNodeSelection(selection, legacyOpenSSL) {
    const lines = [`[setup] node ${selection.version} selected (source: ${selection.source})`];
    if (selection.warning) lines.push(`[setup] ${selection.warning}`);
    if (legacyOpenSSL) lines.push(`[setup] appending --openssl-legacy-provider to NODE_OPTIONS (webpack 4 / react-scripts < 5 needs it on Node ${selection.major})`);
    return lines;
}

module.exports = {
    INSTALLED_VERSIONS_PATH,
    readInstalledVersions,
    parseRequestedMajor,
    selectNodeVersion,
    selectNodeForProject,
    needsLegacyOpenSSL,
    appendNodeOption,
    describeNodeSelection,
};

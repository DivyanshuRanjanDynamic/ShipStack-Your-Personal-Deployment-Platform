const fs = require('fs');
const path = require('path');

// Returns the parsed package.json, {} if it is unreadable, or null if it does not exist.
function readPackageJson(dir) {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

/**
 * Picks the folder to build: the repo root if it has a package.json,
 * otherwise the first subdirectory (in readdir order) that has one.
 * Returns the repo root when nothing matches; the caller reports the missing package.json.
 */
function findProjectDir(repoPath) {
    if (fs.existsSync(path.join(repoPath, 'package.json'))) return repoPath;
    for (const entry of fs.readdirSync(repoPath)) {
        const entryPath = path.join(repoPath, entry);
        if (fs.lstatSync(entryPath).isDirectory() && fs.existsSync(path.join(entryPath, 'package.json'))) {
            return entryPath;
        }
    }
    return repoPath;
}

function allDependencies(pkg) {
    return { ...((pkg && pkg.dependencies) || {}), ...((pkg && pkg.devDependencies) || {}) };
}

// Framework label used in build-context.json.
function detectFramework(pkg) {
    const deps = allDependencies(pkg);
    if (deps.next) return 'next';
    if (deps['react-scripts']) return 'cra';
    if (deps.vite) return 'vite';
    return 'unknown';
}

// Package manager label used in build-context.json.
function detectPackageManager(dir) {
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    return 'npm';
}

function hasLockfile(dir) {
    return ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
        .some((name) => fs.existsSync(path.join(dir, name)));
}

module.exports = {
    readPackageJson,
    findProjectDir,
    allDependencies,
    detectFramework,
    detectPackageManager,
    hasLockfile,
};

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

const FRONTEND_DEPS = ['react', 'vite', 'next', 'vue', 'svelte', '@angular/core', 'astro', 'gatsby', 'react-scripts'];
const SERVER_DEPS = ['express', 'fastify', 'koa', '@nestjs/core'];
const SCAN_DEPTH = 2;

// Why a package.json looks like a deployable frontend: +2 build script, +2 frontend dependency,
// -3 server dependency without a frontend one.
function scorePackage(pkg) {
    const deps = allDependencies(pkg);
    const hasBuild = Boolean(pkg && pkg.scripts && pkg.scripts.build);
    const frontend = FRONTEND_DEPS.find((name) => deps[name]);
    const server = SERVER_DEPS.find((name) => deps[name]);
    let score = 0;
    const reasons = [];
    if (hasBuild) { score += 2; reasons.push('build script'); }
    if (frontend) { score += 2; reasons.push(frontend); }
    if (server && !frontend) { score -= 3; reasons.push(`server-only: ${server}`); }
    return { score, reasons };
}

// Folders (relative, forward slashes) below the repo root that contain a package.json, up to SCAN_DEPTH.
// Skips node_modules, dot folders and symlinks.
function findPackageDirs(repoPath) {
    const found = [];
    function walk(dir, rel, depth) {
        if (depth > SCAN_DEPTH) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const childRel = rel ? `${rel}/${entry.name}` : entry.name;
            const childPath = path.join(dir, entry.name);
            if (fs.existsSync(path.join(childPath, 'package.json'))) found.push(childRel);
            walk(childPath, childRel, depth + 1);
        }
    }
    walk(repoPath, '', 1);
    return found;
}

/**
 * Resolves a configured root directory inside the repo. Rejects absolute paths, `..`,
 * missing folders and symlinks that resolve outside the repo. Returns the real path.
 */
function resolveInsideRepo(repoPath, relative) {
    if (typeof relative !== 'string' || relative.trim() === '') throw new Error('root directory is empty');
    if (path.isAbsolute(relative) || path.win32.isAbsolute(relative) || path.posix.isAbsolute(relative)) {
        throw new Error('root directory must be a relative path');
    }
    if (relative.split(/[\\/]/).includes('..')) throw new Error('root directory must not contain ".."');
    const target = path.resolve(repoPath, relative);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        throw new Error(`root directory "${relative}" does not exist in the repository`);
    }
    const realRepo = fs.realpathSync(repoPath);
    const realTarget = fs.realpathSync(target);
    if (realTarget !== realRepo && !realTarget.startsWith(realRepo + path.sep)) {
        throw new Error(`root directory "${relative}" resolves outside the repository`);
    }
    return realTarget;
}

/**
 * Chooses the folder to build. Order: configured root directory, the repo root when it has a
 * build script or a frontend dependency, then the single best-scoring folder (depth <= 2).
 * A tie or no positive candidate is ROOT_DIR_AMBIGUOUS; never guesses.
 *
 * Returns { ok: true, dir, relative, reason } or
 *         { ok: false, failureReason, error, candidates: [{ relative, score, reasons }] }.
 */
function selectRootDirectory(repoPath, { configured = null } = {}) {
    if (configured !== null && configured !== undefined) {
        try {
            const dir = resolveInsideRepo(repoPath, configured);
            return { ok: true, dir, relative: path.relative(fs.realpathSync(repoPath), dir).replace(/\\/g, '/') || '.', reason: 'project setting' };
        } catch (err) {
            return { ok: false, failureReason: 'ROOT_DIR_AMBIGUOUS', error: err.message, candidates: [] };
        }
    }

    const rootPkg = readPackageJson(repoPath);
    if (rootPkg) {
        const { reasons } = scorePackage(rootPkg);
        const usable = reasons.filter((r) => r === 'build script' || FRONTEND_DEPS.includes(r));
        if (usable.length > 0) {
            return { ok: true, dir: repoPath, relative: '.', reason: usable.join(' + ') };
        }
    }

    const candidates = findPackageDirs(repoPath)
        .map((relative) => ({ relative, ...scorePackage(readPackageJson(path.join(repoPath, relative)) || {}) }))
        .sort((a, b) => b.score - a.score || a.relative.localeCompare(b.relative));

    const best = candidates[0];
    if (!best || best.score <= 0) {
        return {
            ok: false,
            failureReason: 'ROOT_DIR_AMBIGUOUS',
            error: candidates.length === 0 && !rootPkg
                ? 'no package.json found in the repository root or two levels below it'
                : 'no folder has a build script or a frontend dependency',
            candidates,
        };
    }
    const tied = candidates.filter((c) => c.score === best.score);
    if (tied.length > 1) {
        return {
            ok: false,
            failureReason: 'ROOT_DIR_AMBIGUOUS',
            error: `${tied.length} folders are equally likely to be the frontend`,
            candidates,
        };
    }
    return { ok: true, dir: path.join(repoPath, best.relative), relative: best.relative, reason: best.reasons.join(' + ') };
}

// Log lines for a root directory decision.
function describeRootSelection(result) {
    if (result.ok) return [`[setup] root directory: ${result.relative} (reason: ${result.reason})`];
    const lines = [`[setup] could not choose a root directory: ${result.error}`];
    for (const c of result.candidates) {
        lines.push(`[setup]   candidate: ${c.relative} (score ${c.score}: ${c.reasons.join(' + ') || 'no build script, no frontend dependency'})`);
    }
    lines.push('[setup] set the root directory in the project build settings to the folder you want to deploy');
    return lines;
}

function hasLockfile(dir) {
    return ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
        .some((name) => fs.existsSync(path.join(dir, name)));
}

module.exports = {
    readPackageJson,
    FRONTEND_DEPS,
    SERVER_DEPS,
    scorePackage,
    findPackageDirs,
    resolveInsideRepo,
    selectRootDirectory,
    describeRootSelection,
    allDependencies,
    detectFramework,
    detectPackageManager,
    hasLockfile,
};

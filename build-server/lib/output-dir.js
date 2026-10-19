const fs = require('fs');
const path = require('path');
const { nextNoOutputResult } = require('./next-export');

// A candidate output folder qualifies only if it has an index.html directly inside it.
function hasTopLevelIndex(dir) {
    return fs.existsSync(path.join(dir, 'index.html'));
}

function indexMtimeMs(dir) {
    try {
        return fs.statSync(path.join(dir, 'index.html')).mtimeMs;
    } catch {
        return 0;
    }
}

// Immediate subdirectories of dist/ (for Angular's dist/<app>/browser and dist/<app> layouts).
function distSubdirs(projectDir) {
    try {
        return fs.readdirSync(path.join(projectDir, 'dist'), { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
    } catch {
        return [];
    }
}

/**
 * The ordered output-directory candidates, relative to the project folder.
 * .next is never a candidate; public only for Gatsby (CRA's source public/index.html
 * exists before any build and must not be uploaded).
 */
function candidateDirs(projectDir, framework) {
    const rels = ['dist', 'build', 'out', '.output/public'];
    const subs = distSubdirs(projectDir);
    for (const sub of subs) rels.push(`dist/${sub}/browser`);
    for (const sub of subs) rels.push(`dist/${sub}`);
    if (framework === 'gatsby') rels.push('public');
    return rels;
}

// A relative output dir from a project setting must stay inside the project folder.
function resolveConfigured(projectDir, configured) {
    if (path.isAbsolute(configured) || path.win32.isAbsolute(configured) || path.posix.isAbsolute(configured)) {
        throw new Error('output directory must be a relative path');
    }
    if (configured.split(/[\\/]/).includes('..')) {
        throw new Error('output directory must not contain ".."');
    }
    const target = path.resolve(projectDir, configured);
    const realProject = fs.realpathSync(projectDir);
    if (!fs.existsSync(target)) {
        const err = new Error(`output directory "${configured}" does not exist after the build`);
        err.code = 'OUTPUT_MISSING';
        throw err;
    }
    const realTarget = fs.realpathSync(target);
    if (realTarget !== realProject && !realTarget.startsWith(realProject + path.sep)) {
        throw new Error(`output directory "${configured}" resolves outside the project`);
    }
    return realTarget;
}

// A configured output directory that could not be used, with Next-specific guidance appended when
// the framework is Next.js (a missing out/ there usually means output: 'export' is not set).
function configuredFailure(projectDir, framework, errorLine) {
    const base = [`[upload] ${errorLine}`];
    if (framework === 'next') {
        const next = nextNoOutputResult(projectDir);
        return { ok: false, failureReason: next.failureReason, logLines: [...base, ...next.logLines.map((l) => `[upload] ${l}`)] };
    }
    return { ok: false, failureReason: 'UPLOAD_EMPTY', logLines: base };
}

/**
 * Finds the directory to upload after a successful build.
 *
 * Returns { ok: true, dir, relative, warning } or
 *         { ok: false, failureReason, logLines }.
 */
function resolveOutputDir({ projectDir, framework = null, buildStartedMs = 0, configured = null }) {
    if (configured != null && String(configured).trim() !== '') {
        try {
            const dir = resolveConfigured(projectDir, String(configured).trim());
            if (!hasTopLevelIndex(dir)) {
                return configuredFailure(projectDir, framework, `configured output directory "${configured}" has no index.html at its top level`);
            }
            return { ok: true, dir, relative: String(configured).trim(), warning: null };
        } catch (err) {
            return configuredFailure(projectDir, framework, err.message);
        }
    }

    const qualifying = candidateDirs(projectDir, framework)
        .map((relative) => ({ relative, dir: path.join(projectDir, relative) }))
        .filter((c) => fs.existsSync(c.dir) && hasTopLevelIndex(c.dir))
        .map((c) => ({ ...c, fresh: indexMtimeMs(c.dir) >= buildStartedMs }));

    const fresh = qualifying.find((c) => c.fresh);
    if (fresh) {
        return { ok: true, dir: fresh.dir, relative: fresh.relative, warning: null };
    }

    if (qualifying.length > 0) {
        const stale = qualifying[0];
        return {
            ok: true,
            dir: stale.dir,
            relative: stale.relative,
            warning: `uploading ${stale.relative}, but its index.html predates this build (it may be a committed, stale output directory)`,
        };
    }

    if (framework === 'next') {
        const next = nextNoOutputResult(projectDir);
        return {
            ok: false,
            failureReason: next.failureReason,
            logLines: next.logLines.map((l) => `[upload] ${l}`),
        };
    }

    return {
        ok: false,
        failureReason: 'UPLOAD_EMPTY',
        logLines: ['[upload] no output directory with an index.html was found (looked for dist, build, out, .output/public and Angular dist layouts)'],
    };
}

module.exports = { resolveOutputDir, candidateDirs };

const fs = require('fs');
const path = require('path');

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

const NEXT_EXPORT_GUIDANCE = [
    'this app needs a Node server (server rendering or API routes); ShipStack hosts static sites',
    "to deploy as a static site, set output: 'export' in the Next.js config so the build produces out/",
];

/**
 * Finds the directory to upload after a successful build.
 *
 * Returns { ok: true, dir, relative, warning } or
 *         { ok: false, failureReason, logLines }.
 */
function resolveOutputDir({ projectDir, framework = null, buildStartedMs = 0, configured = null }) {
    // A Next.js build that produced no static output needs the export guidance, whatever was configured.
    const nextWithoutStaticOutput = (firstLine) => ({
        ok: false,
        failureReason: 'UNSUPPORTED_PROJECT',
        logLines: [firstLine, ...NEXT_EXPORT_GUIDANCE.map((l) => `[upload] ${l}`)],
    });

    if (configured != null && String(configured).trim() !== '') {
        try {
            const dir = resolveConfigured(projectDir, String(configured).trim());
            if (!hasTopLevelIndex(dir)) {
                const line = `[upload] configured output directory "${configured}" has no index.html at its top level`;
                return framework === 'next' ? nextWithoutStaticOutput(line) : { ok: false, failureReason: 'UPLOAD_EMPTY', logLines: [line] };
            }
            return { ok: true, dir, relative: String(configured).trim(), warning: null };
        } catch (err) {
            const line = `[upload] ${err.message}`;
            if (framework === 'next' && err.code === 'OUTPUT_MISSING') return nextWithoutStaticOutput(line);
            return { ok: false, failureReason: 'UPLOAD_EMPTY', logLines: [line] };
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
        return {
            ok: false,
            failureReason: 'UNSUPPORTED_PROJECT',
            logLines: NEXT_EXPORT_GUIDANCE.map((l) => `[upload] ${l}`),
        };
    }

    return {
        ok: false,
        failureReason: 'UPLOAD_EMPTY',
        logLines: ['[upload] no output directory with an index.html was found (looked for dist, build, out, .output/public and Angular dist layouts)'],
    };
}

module.exports = { resolveOutputDir, candidateDirs, NEXT_EXPORT_GUIDANCE };

const fs = require('fs');
const path = require('path');

// When `next build` runs without `output: 'export'`, Next writes a server bundle to .next/ and no
// uploadable out/ directory. That is not, on its own, a sign the app needs a Node server: most such
// apps are fully static and only need `output: 'export'` turned on. This module reads the finished
// .next/ build to tell the two apart, so the upload step can give accurate guidance instead of
// always blaming server-side rendering.

function dirExists(p) {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// Relative paths (forward slashes) of every file under `dir`, or [] if it is missing.
function listFilesRecursive(dir) {
    try {
        return fs.readdirSync(dir, { recursive: true })
            .map((rel) => String(rel).replace(/\\/g, '/'))
            .filter((rel) => {
                try {
                    return fs.statSync(path.join(dir, rel)).isFile();
                } catch {
                    return false;
                }
            });
    } catch {
        return [];
    }
}

const NEXT_CONFIG_FILES = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts'];

// True when a next.config.* declares `output: 'export'` (single or double quotes).
function hasExportConfig(projectDir) {
    for (const name of NEXT_CONFIG_FILES) {
        let text;
        try {
            text = fs.readFileSync(path.join(projectDir, name), 'utf8');
        } catch {
            continue;
        }
        if (/\boutput\s*:\s*['"]export['"]/.test(text)) return true;
    }
    return false;
}

/**
 * Inspects a finished Next.js build (.next) and reports whether the app needs a Node server.
 *
 * Only high-confidence signals count as server-required: Pages Router API routes
 * (.next/server/pages/api) and App Router route handlers (route.js under .next/server/app).
 * A page that merely uses getServerSideProps is not flagged here — if the user then enables
 * `output: 'export'`, Next itself fails the build with a precise message, which is a better
 * outcome than this step guessing wrong.
 *
 * Returns { inspected, serverRequired, reasons, hasExportConfig }. `inspected` is false when there
 * is no .next/ directory to read (e.g. a custom distDir), so the caller can soften its wording.
 */
function inspectNextBuild(projectDir) {
    const exportConfig = hasExportConfig(projectDir);
    const nextDir = path.join(projectDir, '.next');
    if (!dirExists(nextDir)) {
        return { inspected: false, serverRequired: false, reasons: [], hasExportConfig: exportConfig };
    }

    const reasons = [];
    if (listFilesRecursive(path.join(nextDir, 'server', 'pages', 'api')).length > 0) {
        reasons.push('API routes (pages/api)');
    }
    const handlers = listFilesRecursive(path.join(nextDir, 'server', 'app'))
        .filter((rel) => /(^|\/)route\.js$/.test(rel));
    if (handlers.length > 0) {
        reasons.push('route handlers (app router)');
    }

    return { inspected: true, serverRequired: reasons.length > 0, reasons, hasExportConfig: exportConfig };
}

/**
 * The upload failure for a Next.js build that produced no uploadable output directory.
 * Returns { failureReason, logLines } (logLines carry no "[upload] " prefix; the caller adds it).
 *
 * - Server-required app  -> UNSUPPORTED_PROJECT: it genuinely cannot be hosted as a static site.
 * - Static app / missing export config -> UPLOAD_EMPTY: a fixable configuration problem, phrased
 *   around the missing output directory rather than server-side rendering.
 */
function nextNoOutputResult(projectDir) {
    const info = inspectNextBuild(projectDir);

    if (info.serverRequired) {
        return {
            failureReason: 'UNSUPPORTED_PROJECT',
            logLines: [
                `this Next.js app has ${info.reasons.join(' and ')}, which need a Node server; ShipStack hosts static sites and cannot deploy it`,
                'remove the server-side parts to deploy it statically, or host it on a platform that runs a Node server',
            ],
        };
    }

    if (info.hasExportConfig) {
        return {
            failureReason: 'UPLOAD_EMPTY',
            logLines: [
                "next.config sets output: 'export' but no out/ directory was produced",
                'check for a custom distDir or output path and make sure the export finished, then set the Output Directory to match',
            ],
        };
    }

    return {
        failureReason: 'UPLOAD_EMPTY',
        logLines: [
            "the Next.js build finished but produced no out/ directory, because output: 'export' is not set in the Next.js config",
            "add output: 'export' to next.config.js and redeploy; Next will write the static site to out/",
            'leave the Output Directory setting blank (auto-detected) or set it to out; redirects, rewrites, headers and the default next/image loader are not available in a static export',
        ],
    };
}

module.exports = { inspectNextBuild, nextNoOutputResult, hasExportConfig };

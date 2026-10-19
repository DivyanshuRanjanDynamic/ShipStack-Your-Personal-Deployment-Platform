const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeTree } = require('./helpers');
const { resolveOutputDir, candidateDirs, NEXT_EXPORT_GUIDANCE } = require('../lib/output-dir');

const BUILD_STARTED = 1_000_000_000_000; // fixed reference point
const setIndexMtime = (dir, relative, ms) => {
    const t = new Date(ms);
    fs.utimesSync(path.join(dir, relative, 'index.html'), t, t);
};

describe('candidateDirs', () => {
    it('lists dist, build, out, .output/public, then Angular layouts, never .next', () => {
        const repo = makeTree({ 'dist/app-one/index.html': '', 'dist/app-two/index.html': '' });
        const list = candidateDirs(repo, 'unknown');
        assert.deepStrictEqual(list, [
            'dist', 'build', 'out', '.output/public',
            'dist/app-one/browser', 'dist/app-two/browser',
            'dist/app-one', 'dist/app-two',
        ]);
        assert.ok(!list.includes('.next'));
        assert.ok(!list.includes('public'));
    });

    it('adds public only for Gatsby', () => {
        assert.ok(candidateDirs(makeTree({}), 'gatsby').includes('public'));
        assert.ok(!candidateDirs(makeTree({}), 'cra').includes('public'));
    });
});

describe('resolveOutputDir', () => {
    it('uploads build/ for CRA and never the source public/index.html', () => {
        const repo = makeTree({ 'public/index.html': '', 'build/index.html': '', 'build/static/app.js': '' });
        setIndexMtime(repo, 'build', BUILD_STARTED + 5000);
        setIndexMtime(repo, 'public', BUILD_STARTED - 5000);
        const result = resolveOutputDir({ projectDir: repo, framework: 'cra', buildStartedMs: BUILD_STARTED });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.relative, 'build');
    });

    it('prefers a freshly built directory over a committed, stale one', () => {
        const repo = makeTree({ 'dist/index.html': '', 'build/index.html': '' });
        setIndexMtime(repo, 'dist', BUILD_STARTED - 60000); // committed, stale
        setIndexMtime(repo, 'build', BUILD_STARTED + 60000); // real build
        const result = resolveOutputDir({ projectDir: repo, framework: 'unknown', buildStartedMs: BUILD_STARTED });
        assert.strictEqual(result.relative, 'build');
        assert.strictEqual(result.warning, null);
    });

    it('uploads a stale directory with a warning when nothing fresh exists', () => {
        const repo = makeTree({ 'dist/index.html': '' });
        setIndexMtime(repo, 'dist', BUILD_STARTED - 60000);
        const result = resolveOutputDir({ projectDir: repo, framework: 'unknown', buildStartedMs: BUILD_STARTED });
        assert.strictEqual(result.relative, 'dist');
        assert.match(result.warning, /predates this build/);
    });

    it('detects the Angular dist/<app>/browser layout', () => {
        const repo = makeTree({ 'dist/my-app/browser/index.html': '' });
        setIndexMtime(repo, 'dist/my-app/browser', BUILD_STARTED + 1000);
        assert.strictEqual(resolveOutputDir({ projectDir: repo, framework: 'angular', buildStartedMs: BUILD_STARTED }).relative, 'dist/my-app/browser');
    });

    it('uses public for Gatsby', () => {
        const repo = makeTree({ 'public/index.html': '' });
        setIndexMtime(repo, 'public', BUILD_STARTED + 1000);
        assert.strictEqual(resolveOutputDir({ projectDir: repo, framework: 'gatsby', buildStartedMs: BUILD_STARTED }).relative, 'public');
    });

    it('deploys out/ for a static-export Next.js app', () => {
        const repo = makeTree({ 'out/index.html': '', '.next/BUILD_ID': '' });
        setIndexMtime(repo, 'out', BUILD_STARTED + 1000);
        assert.strictEqual(resolveOutputDir({ projectDir: repo, framework: 'next', buildStartedMs: BUILD_STARTED }).relative, 'out');
    });

    it('fails a server Next.js app with UNSUPPORTED_PROJECT and export guidance', () => {
        const repo = makeTree({ '.next/index.html': '', '.next/BUILD_ID': '' });
        setIndexMtime(repo, '.next', BUILD_STARTED + 1000);
        const result = resolveOutputDir({ projectDir: repo, framework: 'next', buildStartedMs: BUILD_STARTED });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.failureReason, 'UNSUPPORTED_PROJECT');
        assert.deepStrictEqual(result.logLines, NEXT_EXPORT_GUIDANCE.map((l) => `[upload] ${l}`));
    });

    it('fails with UPLOAD_EMPTY when no directory has a top-level index.html', () => {
        const repo = makeTree({ 'dist/app.js': '', 'dist/assets/x.css': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'vite', buildStartedMs: BUILD_STARTED });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
    });

    it('uses a configured output directory, even one detection would skip', () => {
        const repo = makeTree({ 'public/index.html': '' });
        setIndexMtime(repo, 'public', BUILD_STARTED - 5000); // stale, but explicitly configured
        const result = resolveOutputDir({ projectDir: repo, framework: 'cra', buildStartedMs: BUILD_STARTED, configured: 'public' });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.relative, 'public');
    });

    it('fails a configured directory with no index.html', () => {
        const repo = makeTree({ 'public/app.js': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'cra', buildStartedMs: BUILD_STARTED, configured: 'public' });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
    });

    it('rejects a configured directory that escapes the project', () => {
        const repo = makeTree({ 'build/index.html': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'cra', buildStartedMs: BUILD_STARTED, configured: '../other' });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
        assert.match(result.logLines[0], /must not contain/);
    });

    it('gives Next.js export guidance when a configured output dir was not produced', () => {
        const repo = makeTree({ '.next/BUILD_ID': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'next', buildStartedMs: BUILD_STARTED, configured: 'out' });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.failureReason, 'UNSUPPORTED_PROJECT');
        assert.deepStrictEqual(result.logLines, [
            '[upload] output directory "out" does not exist after the build',
            ...NEXT_EXPORT_GUIDANCE.map((l) => `[upload] ${l}`),
        ]);
    });

    it('gives Next.js export guidance when the configured dir has no index.html (e.g. .next)', () => {
        const repo = makeTree({ '.next/BUILD_ID': '', '.next/server/app.js': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'next', buildStartedMs: BUILD_STARTED, configured: '.next' });
        assert.strictEqual(result.failureReason, 'UNSUPPORTED_PROJECT');
        assert.match(result.logLines[0], /has no index\.html/);
        assert.strictEqual(result.logLines.length, 1 + NEXT_EXPORT_GUIDANCE.length);
    });

    it('keeps UPLOAD_EMPTY for a missing configured dir on non-Next frameworks', () => {
        const repo = makeTree({ 'dist/app.js': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'vite', buildStartedMs: BUILD_STARTED, configured: 'build' });
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
        assert.strictEqual(result.logLines.length, 1);
    });

    it('keeps UPLOAD_EMPTY for an invalid configured path even on Next.js', () => {
        const repo = makeTree({ 'out/index.html': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'next', buildStartedMs: BUILD_STARTED, configured: '../out' });
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
        assert.match(result.logLines[0], /must not contain/);
    });

    it('still deploys a configured out/ that a static-export Next.js build produced', () => {
        const repo = makeTree({ 'out/index.html': '' });
        const result = resolveOutputDir({ projectDir: repo, framework: 'next', buildStartedMs: BUILD_STARTED, configured: 'out' });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.relative, 'out');
    });
});

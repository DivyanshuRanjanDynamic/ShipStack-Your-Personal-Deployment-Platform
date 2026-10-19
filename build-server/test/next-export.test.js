const { describe, it } = require('node:test');
const assert = require('node:assert');
const { makeTree } = require('./helpers');
const { inspectNextBuild, nextNoOutputResult, hasExportConfig } = require('../lib/next-export');

describe('hasExportConfig', () => {
    it('finds output: export in next.config.js with single or double quotes', () => {
        assert.ok(hasExportConfig(makeTree({ 'next.config.js': "module.exports = { output: 'export' }" })));
        assert.ok(hasExportConfig(makeTree({ 'next.config.mjs': 'export default { output: "export" };' })));
    });

    it('is false when output is absent or set to something else', () => {
        assert.ok(!hasExportConfig(makeTree({ 'next.config.js': 'module.exports = { reactStrictMode: true }' })));
        assert.ok(!hasExportConfig(makeTree({ 'next.config.js': "module.exports = { output: 'standalone' }" })));
        assert.ok(!hasExportConfig(makeTree({})));
    });
});

describe('inspectNextBuild', () => {
    it('reports not inspected when there is no .next directory', () => {
        const info = inspectNextBuild(makeTree({ 'next.config.js': '' }));
        assert.strictEqual(info.inspected, false);
        assert.strictEqual(info.serverRequired, false);
    });

    it('treats a build with only static pages as not server-required', () => {
        const info = inspectNextBuild(makeTree({ '.next/BUILD_ID': '', '.next/server/app/about/page.js': '' }));
        assert.strictEqual(info.inspected, true);
        assert.strictEqual(info.serverRequired, false);
        assert.deepStrictEqual(info.reasons, []);
    });

    it('flags App Router route handlers', () => {
        const info = inspectNextBuild(makeTree({ '.next/BUILD_ID': '', '.next/server/app/api/hello/route.js': '' }));
        assert.strictEqual(info.serverRequired, true);
        assert.ok(info.reasons.some((r) => r.includes('route handlers')));
    });

    it('flags Pages Router API routes', () => {
        const info = inspectNextBuild(makeTree({ '.next/BUILD_ID': '', '.next/server/pages/api/users.js': '' }));
        assert.strictEqual(info.serverRequired, true);
        assert.ok(info.reasons.some((r) => r.includes('API routes')));
    });

    it('does not mistake an app-router page named route for a handler elsewhere', () => {
        // A page under a segment literally called "route" still ends in page.js, not route.js.
        const info = inspectNextBuild(makeTree({ '.next/BUILD_ID': '', '.next/server/app/route/page.js': '' }));
        assert.strictEqual(info.serverRequired, false);
    });
});

describe('nextNoOutputResult', () => {
    it('gives a static app actionable export guidance, never the "needs a server" wording', () => {
        const result = nextNoOutputResult(makeTree({ '.next/BUILD_ID': '', '.next/server/app/page.js': '' }));
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
        const text = result.logLines.join('\n');
        assert.match(text, /output: 'export'/);
        assert.match(text, /out\//);
        assert.doesNotMatch(text, /needs a Node server/);
    });

    it('marks a server-bound app UNSUPPORTED_PROJECT with the reason', () => {
        const result = nextNoOutputResult(makeTree({ '.next/BUILD_ID': '', '.next/server/pages/api/x.js': '' }));
        assert.strictEqual(result.failureReason, 'UNSUPPORTED_PROJECT');
        assert.match(result.logLines.join('\n'), /API routes.*need a Node server/s);
    });

    it('points at distDir/output when export is configured but out/ is still missing', () => {
        const result = nextNoOutputResult(makeTree({ 'next.config.js': "module.exports = { output: 'export' }", '.next/BUILD_ID': '' }));
        assert.strictEqual(result.failureReason, 'UPLOAD_EMPTY');
        assert.match(result.logLines.join('\n'), /output: 'export' but no out\/ directory/);
    });
});

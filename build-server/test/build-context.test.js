const { describe, it } = require('node:test');
const assert = require('node:assert');
const { makeTree } = require('./helpers');
const { createBuildContext, buildContextKey, uploadBuildContext } = require('../lib/build-context');

// Field list of ai-service/contracts/build-context.ts; every field present, missing ones null.
const CONTRACT_FIELDS = [
    'deployment_id', 'git_url', 'framework', 'package_manager', 'node_version', 'engines',
    'scripts', 'build_command', 'expected_output_dir', 'has_lockfile', 'captured_at',
];

describe('createBuildContext', () => {
    it('reports package.json facts and the given commands', () => {
        const dir = makeTree({
            'package.json': JSON.stringify({ scripts: { build: 'vite build' }, engines: { node: '>=18' }, devDependencies: { vite: '5' } }),
            'package-lock.json': '{}',
        });
        const ctx = createBuildContext({
            projectDir: dir,
            deploymentId: 'd1',
            gitUrl: 'https://github.com/a/b',
            buildCommand: 'npm run build',
            expectedOutputDir: 'dist',
            nodeVersion: 'v22.0.0',
            now: new Date('2026-10-19T00:00:00Z'),
        });
        assert.deepStrictEqual(Object.keys(ctx).sort(), [...CONTRACT_FIELDS].sort());
        assert.deepStrictEqual(ctx, {
            deployment_id: 'd1',
            git_url: 'https://github.com/a/b',
            framework: 'vite',
            package_manager: 'npm',
            node_version: 'v22.0.0',
            engines: { node: '>=18' },
            scripts: { build: 'vite build' },
            build_command: 'npm run build',
            expected_output_dir: 'dist',
            has_lockfile: true,
            captured_at: '2026-10-19T00:00:00.000Z',
        });
    });

    it('uses null for missing engines and scripts', () => {
        const ctx = createBuildContext({ projectDir: makeTree({ 'package.json': '{}' }), deploymentId: 'd1', gitUrl: 'https://x.y/z', buildCommand: 'b', expectedOutputDir: 'dist' });
        assert.strictEqual(ctx.engines, null);
        assert.strictEqual(ctx.scripts, null);
        assert.strictEqual(ctx.has_lockfile, false);
    });
});

describe('uploadBuildContext', () => {
    it('writes JSON under __meta/<deployment>/build-context.json', async () => {
        const puts = [];
        await uploadBuildContext({ objectSink: { put: async (...args) => puts.push(args) }, context: { deployment_id: 'd1' } });
        assert.deepStrictEqual(puts, [['__meta/d1/build-context.json', '{"deployment_id":"d1"}', 'application/json']]);
        assert.strictEqual(buildContextKey('d1'), '__meta/d1/build-context.json');
    });

    it('does not throw when the upload fails', async () => {
        await assert.doesNotReject(uploadBuildContext({ objectSink: { put: async () => { throw new Error('denied'); } }, context: { deployment_id: 'd1' } }));
    });
});

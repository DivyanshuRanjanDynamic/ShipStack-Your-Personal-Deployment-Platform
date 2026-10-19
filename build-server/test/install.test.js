const { describe, it } = require('node:test');
const assert = require('node:assert');
const { resolveInstallCommand, resolveBuildCommand } = require('../lib/install');

describe('resolveInstallCommand', () => {
    it('is npm install', () => {
        assert.strictEqual(resolveInstallCommand(), 'npm install');
    });
});

describe('resolveBuildCommand', () => {
    it('runs the build script when present', () => {
        assert.strictEqual(resolveBuildCommand({ scripts: { build: 'vite build' } }), 'npm run build');
    });

    it('falls back to npx vite build without a build script', () => {
        assert.strictEqual(resolveBuildCommand({ scripts: { start: 'node .' } }), 'npx vite build');
        assert.strictEqual(resolveBuildCommand({}), 'npx vite build');
    });
});

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readBuildSettings } = require('../lib/settings');

describe('readBuildSettings', () => {
    it('returns all-null with no log lines when nothing is set', () => {
        const { settings, logLines } = readBuildSettings({});
        assert.deepStrictEqual(settings, { rootDirectory: null, installCommand: null, buildCommand: null, outputDirectory: null, nodeVersion: null });
        assert.deepStrictEqual(logLines, []);
    });

    it('applies valid settings and logs them', () => {
        const { settings, logLines } = readBuildSettings({
            BUILD_ROOT_DIR: 'frontend',
            BUILD_INSTALL_CMD: 'npm ci',
            BUILD_CMD: 'npm run build:prod',
            BUILD_OUTPUT_DIR: 'dist/app',
            NODE_VERSION: '18',
        });
        assert.deepStrictEqual(settings, {
            rootDirectory: 'frontend',
            installCommand: 'npm ci',
            buildCommand: 'npm run build:prod',
            outputDirectory: 'dist/app',
            nodeVersion: '18',
        });
        assert.ok(logLines.includes('[setup] applied root directory setting: frontend'));
        assert.ok(logLines.includes('[setup] applied node version setting: 18'));
    });

    it('trims surrounding whitespace', () => {
        assert.strictEqual(readBuildSettings({ BUILD_ROOT_DIR: '  apps/web  ' }).settings.rootDirectory, 'apps/web');
    });

    it('ignores an absolute or escaping root/output directory', () => {
        for (const bad of ['/etc', 'C:\\Windows', '../outside', 'a/../../b']) {
            const { settings, logLines } = readBuildSettings({ BUILD_ROOT_DIR: bad });
            assert.strictEqual(settings.rootDirectory, null, bad);
            assert.ok(logLines.includes('[setup] ignoring root directory setting (invalid)'), bad);
        }
    });

    it('ignores an over-long path or command', () => {
        assert.strictEqual(readBuildSettings({ BUILD_ROOT_DIR: 'a'.repeat(201) }).settings.rootDirectory, null);
        assert.strictEqual(readBuildSettings({ BUILD_CMD: 'x'.repeat(501) }).settings.buildCommand, null);
    });

    it('ignores empty values as if unset', () => {
        const { settings, logLines } = readBuildSettings({ BUILD_ROOT_DIR: '   ', NODE_VERSION: '' });
        assert.strictEqual(settings.rootDirectory, null);
        assert.strictEqual(settings.nodeVersion, null);
        assert.deepStrictEqual(logLines, []);
    });
});

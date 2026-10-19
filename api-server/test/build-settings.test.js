const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseBuildSettings, buildSettingsEnv } = require('../src/build-settings');

describe('parseBuildSettings', () => {
    it('returns all-null for null/undefined input', () => {
        assert.deepStrictEqual(parseBuildSettings(null), {
            ok: true,
            settings: { rootDirectory: null, installCommand: null, buildCommand: null, outputDirectory: null, nodeVersion: null },
        });
    });

    it('accepts a valid settings object', () => {
        const r = parseBuildSettings({ rootDirectory: 'frontend', installCommand: 'npm ci', buildCommand: 'npm run build', outputDirectory: 'dist', nodeVersion: '18' });
        assert.strictEqual(r.ok, true);
        assert.deepStrictEqual(r.settings, { rootDirectory: 'frontend', installCommand: 'npm ci', buildCommand: 'npm run build', outputDirectory: 'dist', nodeVersion: '18' });
    });

    it('strips unknown keys, so the old frontend shape yields all-null (no error)', () => {
        const r = parseBuildSettings({ framework: 'React', rootDir: './', outDir: 'dist', installCmd: 'npm i', buildCmd: 'npm run build' });
        assert.strictEqual(r.ok, true);
        assert.deepStrictEqual(r.settings, { rootDirectory: null, installCommand: null, buildCommand: null, outputDirectory: null, nodeVersion: null });
    });

    it('rejects an absolute or escaping path', () => {
        assert.strictEqual(parseBuildSettings({ rootDirectory: '/etc' }).ok, false);
        assert.strictEqual(parseBuildSettings({ rootDirectory: '../x' }).ok, false);
        assert.strictEqual(parseBuildSettings({ outputDirectory: 'C:\\Windows' }).ok, false);
    });

    it('rejects an over-long path or command', () => {
        assert.strictEqual(parseBuildSettings({ rootDirectory: 'a'.repeat(201) }).ok, false);
        assert.strictEqual(parseBuildSettings({ buildCommand: 'x'.repeat(501) }).ok, false);
    });

    it('rejects a node version that is not an installed major', () => {
        assert.strictEqual(parseBuildSettings({ nodeVersion: '19' }).ok, false);
        assert.strictEqual(parseBuildSettings({ nodeVersion: '18' }).ok, true);
    });

    it('treats explicit nulls as auto-detect', () => {
        const r = parseBuildSettings({ rootDirectory: null, nodeVersion: null });
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.settings.rootDirectory, null);
    });
});

describe('buildSettingsEnv', () => {
    it('emits only non-null settings as BUILD_* / NODE_VERSION', () => {
        const env = buildSettingsEnv({ rootDirectory: 'frontend', installCommand: null, buildCommand: 'npm run build', outputDirectory: null, nodeVersion: '18' });
        assert.deepStrictEqual(env, [
            { name: 'BUILD_ROOT_DIR', value: 'frontend' },
            { name: 'BUILD_CMD', value: 'npm run build' },
            { name: 'NODE_VERSION', value: '18' },
        ]);
    });

    it('emits nothing when all settings are null or the project is missing', () => {
        assert.deepStrictEqual(buildSettingsEnv({ rootDirectory: null, installCommand: null, buildCommand: null, outputDirectory: null, nodeVersion: null }), []);
        assert.deepStrictEqual(buildSettingsEnv(null), []);
    });
});

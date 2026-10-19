const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { FIXTURES, makeTree } = require('./helpers');
const {
    readPackageJson,
    findProjectDir,
    detectFramework,
    detectPackageManager,
    hasLockfile,
} = require('../lib/detect');

describe('readPackageJson', () => {
    it('returns null when there is no package.json', () => {
        assert.strictEqual(readPackageJson(path.join(FIXTURES, 'no-package')), null);
    });

    it('returns {} when package.json is not valid JSON', () => {
        const dir = makeTree({ 'package.json': '{ not json' });
        assert.deepStrictEqual(readPackageJson(dir), {});
    });

    it('parses a valid package.json', () => {
        assert.strictEqual(readPackageJson(path.join(FIXTURES, 'root-package')).name, 'root');
    });
});

describe('findProjectDir', () => {
    it('uses the repo root when it has a package.json', () => {
        const repo = path.join(FIXTURES, 'root-package');
        assert.strictEqual(findProjectDir(repo), repo);
    });

    it('otherwise uses the first subdirectory with a package.json', () => {
        const repo = path.join(FIXTURES, 'subdir-only');
        assert.strictEqual(findProjectDir(repo), path.join(repo, 'b-app'));
    });

    it('returns the repo root when no folder has a package.json', () => {
        const repo = path.join(FIXTURES, 'no-package');
        assert.strictEqual(findProjectDir(repo), repo);
    });
});

describe('detectFramework', () => {
    it('detects next before react-scripts and vite', () => {
        assert.strictEqual(detectFramework({ dependencies: { next: '14', 'react-scripts': '5', vite: '5' } }), 'next');
    });

    it('detects cra from react-scripts', () => {
        assert.strictEqual(detectFramework({ dependencies: { 'react-scripts': '5.0.1' } }), 'cra');
    });

    it('detects vite from devDependencies', () => {
        assert.strictEqual(detectFramework({ devDependencies: { vite: '^5.0.0' } }), 'vite');
    });

    it('returns unknown otherwise', () => {
        assert.strictEqual(detectFramework({ dependencies: { express: '4' } }), 'unknown');
        assert.strictEqual(detectFramework({}), 'unknown');
    });
});

describe('detectPackageManager', () => {
    it('detects yarn from yarn.lock', () => {
        assert.strictEqual(detectPackageManager(path.join(FIXTURES, 'lock-yarn')), 'yarn');
    });

    it('detects pnpm from pnpm-lock.yaml', () => {
        assert.strictEqual(detectPackageManager(path.join(FIXTURES, 'lock-pnpm')), 'pnpm');
    });

    it('prefers yarn when both yarn.lock and pnpm-lock.yaml exist', () => {
        assert.strictEqual(detectPackageManager(path.join(FIXTURES, 'lock-yarn-and-pnpm')), 'yarn');
    });

    it('defaults to npm', () => {
        assert.strictEqual(detectPackageManager(path.join(FIXTURES, 'lock-npm')), 'npm');
        assert.strictEqual(detectPackageManager(path.join(FIXTURES, 'no-lockfile')), 'npm');
    });
});

describe('hasLockfile', () => {
    it('is true for any supported lockfile', () => {
        for (const name of ['lock-npm', 'lock-yarn', 'lock-pnpm']) {
            assert.strictEqual(hasLockfile(path.join(FIXTURES, name)), true, name);
        }
    });

    it('is false without a lockfile', () => {
        assert.strictEqual(hasLockfile(path.join(FIXTURES, 'no-lockfile')), false);
    });
});

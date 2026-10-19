const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { FIXTURES, makeTree } = require('./helpers');
const {
    readPackageJson,
    scorePackage,
    findPackageDirs,
    resolveInsideRepo,
    selectRootDirectory,
    describeRootSelection,
    detectFramework,
    detectPackageManager,
    detectPackageManagerWithSource,
    isWorkspaceRoot,
    findWorkspaceProtocolDeps,
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

describe('scorePackage', () => {
    it('adds 2 for a build script and 2 for a frontend dependency', () => {
        assert.deepStrictEqual(scorePackage({ scripts: { build: 'vite build' }, devDependencies: { vite: '5' } }), { score: 4, reasons: ['build script', 'vite'] });
    });

    it('subtracts 3 for a server-only package', () => {
        assert.deepStrictEqual(scorePackage({ scripts: { build: 'tsc' }, dependencies: { express: '4' } }), { score: -1, reasons: ['build script', 'server-only: express'] });
    });

    it('does not penalize a server dependency next to a frontend one', () => {
        assert.strictEqual(scorePackage({ dependencies: { next: '14', express: '4' } }).score, 2);
    });

    it('recognizes every listed frontend framework', () => {
        for (const dep of ['react', 'vite', 'next', 'vue', 'svelte', '@angular/core', 'astro', 'gatsby', 'react-scripts']) {
            assert.strictEqual(scorePackage({ dependencies: { [dep]: '1' } }).score, 2, dep);
        }
    });
});

describe('findPackageDirs', () => {
    it('scans two levels and skips node_modules, dot folders and deeper folders', () => {
        const repo = makeTree({
            'web/package.json': '{}',
            'apps/site/package.json': '{}',
            'a/b/c/package.json': '{}',
            'node_modules/react/package.json': '{}',
            '.github/actions/package.json': '{}',
        });
        assert.deepStrictEqual(findPackageDirs(repo).sort(), ['apps/site', 'web']);
    });
});

describe('selectRootDirectory', () => {
    it('uses the repo root when it has a build script', () => {
        const repo = path.join(FIXTURES, 'root-package');
        assert.deepStrictEqual(selectRootDirectory(repo), { ok: true, dir: repo, relative: '.', reason: 'build script' });
    });

    it('uses the repo root when it has a frontend dependency but no build script', () => {
        const repo = makeTree({
            'package.json': JSON.stringify({ dependencies: { react: '18' } }),
            'docs/package.json': JSON.stringify({ scripts: { build: 'x' }, dependencies: { vue: '3' } }),
        });
        const result = selectRootDirectory(repo);
        assert.strictEqual(result.relative, '.');
        assert.strictEqual(result.reason, 'react');
    });

    it('picks the frontend in a MERN repo whose root package.json is not buildable', () => {
        const repo = path.join(FIXTURES, 'mern');
        const result = selectRootDirectory(repo);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.dir, path.join(repo, 'frontend'));
        assert.deepStrictEqual(describeRootSelection(result), ['[setup] root directory: frontend (reason: build script + react)']);
    });

    it('scans when the root has no package.json', () => {
        const repo = makeTree({
            'client/package.json': JSON.stringify({ scripts: { build: 'vite build' }, devDependencies: { vite: '5' } }),
            'server/package.json': JSON.stringify({ dependencies: { express: '4' } }),
        });
        assert.strictEqual(selectRootDirectory(repo).relative, 'client');
    });

    it('prefers a frontend with a build script over one without', () => {
        const repo = makeTree({
            'a/package.json': JSON.stringify({ dependencies: { react: '18' } }),
            'b/package.json': JSON.stringify({ scripts: { build: 'vite build' }, dependencies: { react: '18' } }),
        });
        assert.strictEqual(selectRootDirectory(repo).relative, 'b');
    });

    it('fails with ROOT_DIR_AMBIGUOUS on a tie and lists the candidates', () => {
        const result = selectRootDirectory(path.join(FIXTURES, 'two-frontends'));
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.failureReason, 'ROOT_DIR_AMBIGUOUS');
        assert.deepStrictEqual(describeRootSelection(result), [
            '[setup] could not choose a root directory: 2 folders are equally likely to be the frontend',
            '[setup]   candidate: apps/admin (score 4: build script + react)',
            '[setup]   candidate: apps/web (score 4: build script + react)',
            '[setup] set the root directory in the project build settings to the folder you want to deploy',
        ]);
    });

    it('fails when no candidate scores above zero, instead of picking the first folder', () => {
        for (const name of ['subdir-only', 'server-only']) {
            const result = selectRootDirectory(path.join(FIXTURES, name));
            assert.strictEqual(result.ok, false, name);
            assert.strictEqual(result.failureReason, 'ROOT_DIR_AMBIGUOUS', name);
            assert.strictEqual(result.error, 'no folder has a build script or a frontend dependency', name);
        }
    });

    it('fails when the repo has no package.json at all', () => {
        const result = selectRootDirectory(path.join(FIXTURES, 'no-package'));
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.error, 'no package.json found in the repository root or two levels below it');
    });

    it('uses a configured root directory before detection', () => {
        const result = selectRootDirectory(path.join(FIXTURES, 'two-frontends'), { configured: 'apps/web' });
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.relative, 'apps/web');
        assert.strictEqual(result.reason, 'project setting');
    });

    it('fails instead of guessing when the configured root directory is invalid', () => {
        const result = selectRootDirectory(path.join(FIXTURES, 'mern'), { configured: '../outside' });
        assert.strictEqual(result.ok, false);
        assert.match(result.error, /must not contain/);
    });
});

describe('resolveInsideRepo', () => {
    const repo = path.join(FIXTURES, 'mern');

    it('accepts relative folders inside the repo, including "." and "./x/"', () => {
        assert.strictEqual(resolveInsideRepo(repo, 'frontend'), fs.realpathSync(path.join(repo, 'frontend')));
        assert.strictEqual(resolveInsideRepo(repo, './frontend/'), fs.realpathSync(path.join(repo, 'frontend')));
        assert.strictEqual(resolveInsideRepo(repo, '.'), fs.realpathSync(repo));
    });

    it('rejects .. segments, absolute paths, empty values and missing folders', () => {
        assert.throws(() => resolveInsideRepo(repo, '..'), /must not contain/);
        assert.throws(() => resolveInsideRepo(repo, 'frontend/../../x'), /must not contain/);
        assert.throws(() => resolveInsideRepo(repo, 'frontend\\..\\..'), /must not contain/);
        assert.throws(() => resolveInsideRepo(repo, '/etc'), /relative/);
        assert.throws(() => resolveInsideRepo(repo, 'C:\\Windows'), /relative/);
        assert.throws(() => resolveInsideRepo(repo, '  '), /empty/);
        assert.throws(() => resolveInsideRepo(repo, 'missing'), /does not exist/);
    });

    it('rejects a symlink that resolves outside the repo', () => {
        const outside = makeTree({ 'secret/file.txt': 'x' });
        const inside = makeTree({ 'package.json': '{}' });
        fs.symlinkSync(path.join(outside, 'secret'), path.join(inside, 'link'), 'junction');
        assert.throws(() => resolveInsideRepo(inside, 'link'), /outside the repository/);
    });

    it('accepts a symlink that stays inside the repo', () => {
        const repoDir = makeTree({ 'real/package.json': '{}' });
        fs.symlinkSync(path.join(repoDir, 'real'), path.join(repoDir, 'alias'), 'junction');
        assert.strictEqual(resolveInsideRepo(repoDir, 'alias'), fs.realpathSync(path.join(repoDir, 'real')));
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

    it('prefers pnpm-lock.yaml over yarn.lock (spec order: pnpm, yarn, npm)', () => {
        assert.strictEqual(detectPackageManager(path.join(FIXTURES, 'lock-yarn-and-pnpm')), 'pnpm');
    });

    it('prefers yarn.lock over package-lock.json', () => {
        assert.strictEqual(detectPackageManager(makeTree({ 'package.json': '{}', 'yarn.lock': '', 'package-lock.json': '{}' })), 'yarn');
    });

    it('detects npm from package-lock.json, and defaults to npm', () => {
        assert.deepStrictEqual(detectPackageManagerWithSource(path.join(FIXTURES, 'lock-npm')), { manager: 'npm', source: 'package-lock.json', ignored: null });
        assert.deepStrictEqual(detectPackageManagerWithSource(path.join(FIXTURES, 'no-lockfile')), { manager: 'npm', source: 'default', ignored: null });
    });

    it('prefers the packageManager field over any lockfile', () => {
        const dir = makeTree({ 'package.json': JSON.stringify({ packageManager: 'yarn@4.5.0' }), 'pnpm-lock.yaml': '' });
        assert.deepStrictEqual(detectPackageManagerWithSource(dir), { manager: 'yarn', source: 'packageManager "yarn@4.5.0"' });
    });
});

describe('isWorkspaceRoot', () => {
    it('is true for a workspaces field (array or object) or pnpm-workspace.yaml', () => {
        assert.strictEqual(isWorkspaceRoot(makeTree({ 'package.json': JSON.stringify({ workspaces: ['apps/*'] }) })), true);
        assert.strictEqual(isWorkspaceRoot(makeTree({ 'package.json': JSON.stringify({ workspaces: { packages: ['apps/*'] } }) })), true);
        assert.strictEqual(isWorkspaceRoot(makeTree({ 'pnpm-workspace.yaml': 'packages: []' })), true);
    });

    it('is false otherwise', () => {
        assert.strictEqual(isWorkspaceRoot(path.join(FIXTURES, 'mern')), false);
        assert.strictEqual(isWorkspaceRoot(path.join(FIXTURES, 'no-package')), false);
    });
});

describe('findWorkspaceProtocolDeps', () => {
    it('finds workspace: specs in every dependency field of the root and scanned folders', () => {
        const repo = makeTree({
            'package.json': JSON.stringify({ devDependencies: { tooling: 'workspace:*' } }),
            'apps/web/package.json': JSON.stringify({ dependencies: { ui: 'workspace:^1.0.0', react: '18' }, peerDependencies: { core: 'workspace:~' } }),
            'node_modules/x/package.json': JSON.stringify({ dependencies: { y: 'workspace:*' } }),
        });
        assert.deepStrictEqual(findWorkspaceProtocolDeps(repo).sort(), [
            '.: tooling@workspace:*',
            'apps/web: core@workspace:~',
            'apps/web: ui@workspace:^1.0.0',
        ]);
    });

    it('is empty for a normal repo', () => {
        assert.deepStrictEqual(findWorkspaceProtocolDeps(path.join(FIXTURES, 'mern')), []);
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

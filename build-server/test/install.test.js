const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeTree, recordingLogSink } = require('./helpers');
const {
    planInstall,
    runInstall,
    planBuild,
    pnpmLockfileVersion,
    pnpmVersionForLockfile,
    writePnpmShim,
} = require('../lib/install');

const pkg = (obj) => JSON.stringify(obj);

describe('planInstall', () => {
    it('uses npm install in the project folder by default', () => {
        const repo = makeTree({ 'package.json': pkg({ scripts: { build: 'vite build' } }) });
        const plan = planInstall({ repoPath: repo, projectDir: repo });
        assert.strictEqual(plan.ok, true);
        assert.strictEqual(plan.cwd, repo);
        assert.strictEqual(plan.manager, 'npm');
        assert.strictEqual(plan.command, 'npm install');
        assert.deepStrictEqual(plan.logLines, [
            '[setup] package manager: npm (source: default)',
            '[setup] install command: npm install (in .)',
        ]);
    });

    it('uses yarn and pnpm with --frozen-lockfile from their lockfiles', () => {
        const yarnRepo = makeTree({ 'package.json': '{}', 'yarn.lock': '' });
        assert.strictEqual(planInstall({ repoPath: yarnRepo, projectDir: yarnRepo }).command, 'yarn install --frozen-lockfile');
        const pnpmRepo = makeTree({ 'package.json': '{}', 'pnpm-lock.yaml': '' });
        assert.strictEqual(planInstall({ repoPath: pnpmRepo, projectDir: pnpmRepo }).command, 'pnpm install --frozen-lockfile');
    });

    it('prefers the packageManager field over lockfiles', () => {
        const repo = makeTree({ 'package.json': pkg({ packageManager: 'pnpm@9.12.0+sha512.abc' }), 'package-lock.json': '{}' });
        const plan = planInstall({ repoPath: repo, projectDir: repo });
        assert.strictEqual(plan.manager, 'pnpm');
        assert.strictEqual(plan.logLines[0], '[setup] package manager: pnpm (source: packageManager "pnpm@9.12.0")');
    });

    it('installs from the repo root of a workspace and builds in the project folder', () => {
        const repo = makeTree({
            'package.json': pkg({ private: true }),
            'pnpm-workspace.yaml': 'packages:\n  - apps/*\n',
            'pnpm-lock.yaml': '',
            'apps/web/package.json': pkg({ scripts: { build: 'vite build' }, dependencies: { lib: 'workspace:*' } }),
        });
        const plan = planInstall({ repoPath: repo, projectDir: path.join(repo, 'apps/web') });
        assert.strictEqual(plan.ok, true);
        assert.strictEqual(plan.cwd, repo);
        assert.strictEqual(plan.manager, 'pnpm');
        assert.strictEqual(plan.logLines.at(-1), '[setup] install command: pnpm install --frozen-lockfile (in repository root (workspace))');
    });

    it('installs in the project folder when the root is not a workspace root', () => {
        const repo = makeTree({ 'package.json': pkg({ dependencies: { express: '4' } }), 'web/package.json': pkg({}), 'web/yarn.lock': '' });
        const plan = planInstall({ repoPath: repo, projectDir: path.join(repo, 'web') });
        assert.strictEqual(plan.cwd, path.join(repo, 'web'));
        assert.strictEqual(plan.manager, 'yarn');
    });

    it('fails with UNSUPPORTED_PROJECT when npm would have to install workspace: dependencies', () => {
        const repo = makeTree({
            'package.json': pkg({ private: true, workspaces: ['apps/*', 'packages/*'] }),
            'apps/web/package.json': pkg({ dependencies: { '@fx/ui': 'workspace:*' } }),
            'packages/ui/package.json': pkg({ name: '@fx/ui' }),
        });
        const plan = planInstall({ repoPath: repo, projectDir: path.join(repo, 'apps/web') });
        assert.strictEqual(plan.ok, false);
        assert.strictEqual(plan.failureReason, 'UNSUPPORTED_PROJECT');
        assert.match(plan.logLines.join('\n'), /apps\/web: @fx\/ui@workspace:\*/);
        assert.match(plan.logLines.join('\n'), /needs pnpm or yarn/);
    });

    it('allows workspace: dependencies with pnpm and yarn', () => {
        const repo = makeTree({
            'package.json': pkg({ private: true, workspaces: ['apps/*'] }),
            'yarn.lock': '',
            'apps/web/package.json': pkg({ dependencies: { lib: 'workspace:^' } }),
        });
        assert.strictEqual(planInstall({ repoPath: repo, projectDir: path.join(repo, 'apps/web') }).ok, true);
    });

    it('reports an unsupported packageManager and falls back to lockfiles', () => {
        const repo = makeTree({ 'package.json': pkg({ packageManager: 'bun@1.1.0' }), 'yarn.lock': '' });
        const plan = planInstall({ repoPath: repo, projectDir: repo });
        assert.strictEqual(plan.manager, 'yarn');
        assert.strictEqual(plan.logLines[0], '[setup] packageManager "bun@1.1.0" is not supported; detecting from lockfiles');
    });

    it('uses a configured install command as is, with no retry', () => {
        const repo = makeTree({ 'package.json': '{}', 'yarn.lock': '' });
        const plan = planInstall({ repoPath: repo, projectDir: repo, installCommand: 'npm ci' });
        assert.strictEqual(plan.command, 'npm ci');
        assert.strictEqual(plan.retry, null);
    });
});

// Fake runner: returns the queued results in order and records the commands.
function fakeRunner(results) {
    const commands = [];
    return {
        commands,
        run: async (command) => {
            commands.push(command);
            return results.shift();
        },
    };
}

function planFor(manager) {
    const repo = makeTree({ 'package.json': '{}', ...(manager === 'yarn' ? { 'yarn.lock': '' } : {}), ...(manager === 'pnpm' ? { 'pnpm-lock.yaml': '' } : {}) });
    return planInstall({ repoPath: repo, projectDir: repo });
}

describe('runInstall', () => {
    it('does not retry when the first attempt succeeds', async () => {
        const runner = fakeRunner([{ exitCode: 0, tail: 'added 10 packages' }]);
        const logs = recordingLogSink();
        const result = await runInstall({ plan: planFor('npm'), run: runner.run, logSink: logs });
        assert.deepStrictEqual(result, { ok: true, exitCode: 0, attempts: 1 });
        assert.deepStrictEqual(runner.commands, ['npm install']);
    });

    it('retries npm once with --legacy-peer-deps on ERESOLVE and reports one successful step', async () => {
        const runner = fakeRunner([{ exitCode: 1, tail: 'npm error code ERESOLVE\nnpm error ERESOLVE could not resolve' }, { exitCode: 0, tail: '' }]);
        const logs = recordingLogSink();
        const result = await runInstall({ plan: planFor('npm'), run: runner.run, logSink: logs });

        assert.deepStrictEqual(result, { ok: true, exitCode: 0, attempts: 2 });
        assert.deepStrictEqual(runner.commands, ['npm install', 'npm install --legacy-peer-deps']);
        assert.deepStrictEqual(logs.events, [
            { log: '[install:start]', step: 'install', event: 'step_start' },
            { log: '[setup] retrying install with --legacy-peer-deps (peer dependency conflict)', step: 'install' },
            { log: '[install:end] exit_code=0', step: 'install', event: 'step_end', exit_code: 0 },
        ]);
    });

    it('reports failure only once when the retry also fails', async () => {
        const runner = fakeRunner([{ exitCode: 1, tail: 'ERESOLVE' }, { exitCode: 1, tail: 'ERESOLVE again' }]);
        const logs = recordingLogSink();
        const result = await runInstall({ plan: planFor('npm'), run: runner.run, logSink: logs });

        assert.deepStrictEqual(result, { ok: false, exitCode: 1, attempts: 2 });
        const ends = logs.events.filter((e) => e.event === 'step_end');
        assert.deepStrictEqual(ends, [{ log: '[install:end] exit_code=1', step: 'install', event: 'step_end', exit_code: 1, failure_reason: 'NONZERO_EXIT' }]);
    });

    it('never retries npm for other errors', async () => {
        for (const tail of ['npm error code E404', 'npm error code ETARGET', 'gyp ERR! build error', 'EBADENGINE']) {
            const runner = fakeRunner([{ exitCode: 1, tail }]);
            const result = await runInstall({ plan: planFor('npm'), run: runner.run, logSink: recordingLogSink() });
            assert.strictEqual(result.attempts, 1, tail);
            assert.deepStrictEqual(runner.commands, ['npm install'], tail);
        }
    });

    it('retries yarn without --frozen-lockfile only when the lockfile is out of date', async () => {
        let runner = fakeRunner([{ exitCode: 1, tail: 'error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.' }, { exitCode: 0, tail: '' }]);
        await runInstall({ plan: planFor('yarn'), run: runner.run, logSink: recordingLogSink() });
        assert.deepStrictEqual(runner.commands, ['yarn install --frozen-lockfile', 'yarn install']);

        runner = fakeRunner([{ exitCode: 1, tail: 'error An unexpected error occurred: "https://registry.yarnpkg.com/x: Not found".' }]);
        await runInstall({ plan: planFor('yarn'), run: runner.run, logSink: recordingLogSink() });
        assert.deepStrictEqual(runner.commands, ['yarn install --frozen-lockfile']);
    });

    it('retries pnpm without --frozen-lockfile only when the lockfile is out of date or missing', async () => {
        let runner = fakeRunner([{ exitCode: 1, tail: 'ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"' }, { exitCode: 0, tail: '' }]);
        await runInstall({ plan: planFor('pnpm'), run: runner.run, logSink: recordingLogSink() });
        assert.deepStrictEqual(runner.commands, ['pnpm install --frozen-lockfile', 'pnpm install --no-frozen-lockfile']);

        runner = fakeRunner([{ exitCode: 1, tail: 'ERR_PNPM_FETCH_404' }]);
        await runInstall({ plan: planFor('pnpm'), run: runner.run, logSink: recordingLogSink() });
        assert.deepStrictEqual(runner.commands, ['pnpm install --frozen-lockfile']);
    });

    it('does not retry a configured install command', async () => {
        const repo = makeTree({ 'package.json': '{}' });
        const runner = fakeRunner([{ exitCode: 1, tail: 'ERESOLVE' }]);
        const result = await runInstall({ plan: planInstall({ repoPath: repo, projectDir: repo, installCommand: 'npm ci' }), run: runner.run, logSink: recordingLogSink() });
        assert.strictEqual(result.attempts, 1);
    });
});

describe('planBuild', () => {
    it('runs the build script with the detected package manager', () => {
        const dir = makeTree({ 'package.json': pkg({ scripts: { build: 'vite build' } }) });
        for (const manager of ['npm', 'yarn', 'pnpm']) {
            const plan = planBuild({ projectDir: dir, manager });
            assert.strictEqual(plan.ok, true);
            assert.strictEqual(plan.command, `${manager} run build`);
        }
    });

    it('fails with MISSING_BUILD_SCRIPT instead of guessing npx vite build', () => {
        const dir = makeTree({ 'package.json': pkg({ scripts: { start: 'node .' }, devDependencies: { vite: '5' } }) });
        const plan = planBuild({ projectDir: dir, manager: 'npm' });
        assert.strictEqual(plan.ok, false);
        assert.strictEqual(plan.failureReason, 'MISSING_BUILD_SCRIPT');
        assert.ok(!JSON.stringify(plan).includes('npx vite build'));
    });

    it('uses a configured build command even without a build script', () => {
        const dir = makeTree({ 'package.json': '{}' });
        assert.deepStrictEqual(planBuild({ projectDir: dir, manager: 'npm', buildCommand: 'npx vite build --base=/app/' }).command, 'npx vite build --base=/app/');
    });
});

describe('pnpm version pinning', () => {
    it('reads lockfileVersion in quoted and unquoted forms', () => {
        assert.strictEqual(pnpmLockfileVersion(makeTree({ 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n\nsettings:\n" })), '9.0');
        assert.strictEqual(pnpmLockfileVersion(makeTree({ 'pnpm-lock.yaml': 'lockfileVersion: 5.4\n' })), '5.4');
        assert.strictEqual(pnpmLockfileVersion(makeTree({ 'pnpm-lock.yaml': 'packages: {}\n' })), null);
        assert.strictEqual(pnpmLockfileVersion(makeTree({})), null);
    });

    it('maps each lockfile format to the pnpm release line that writes it', () => {
        assert.strictEqual(pnpmVersionForLockfile('9.0'), '9.15.9');
        assert.strictEqual(pnpmVersionForLockfile('6.0'), '8.15.9');
        assert.strictEqual(pnpmVersionForLockfile('6.1'), '8.15.9');
        assert.strictEqual(pnpmVersionForLockfile('5.4'), '7.33.7');
        assert.strictEqual(pnpmVersionForLockfile('5.3'), '6.35.1');
        assert.strictEqual(pnpmVersionForLockfile('10.0'), null);
        assert.strictEqual(pnpmVersionForLockfile(null), null);
    });

    it('pins pnpm from the lockfile when there is no packageManager field', () => {
        const repo = makeTree({ 'package.json': pkg({ scripts: { build: 'next build' } }), 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" });
        const plan = planInstall({ repoPath: repo, projectDir: repo });
        assert.strictEqual(plan.pnpmPin, '9.15.9');
        assert.ok(plan.logLines.includes('[setup] pnpm 9.15.9 pinned (source: pnpm-lock.yaml lockfileVersion 9.0; no packageManager field)'));
        assert.strictEqual(plan.command, 'pnpm install --frozen-lockfile');
    });

    it('keeps the pin when the install command is configured', () => {
        const repo = makeTree({ 'package.json': '{}', 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" });
        assert.strictEqual(planInstall({ repoPath: repo, projectDir: repo, installCommand: 'pnpm i' }).pnpmPin, '9.15.9');
    });

    it('does not pin when packageManager names a pnpm version', () => {
        const repo = makeTree({ 'package.json': pkg({ packageManager: 'pnpm@10.4.1' }), 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" });
        assert.strictEqual(planInstall({ repoPath: repo, projectDir: repo }).pnpmPin, null);
    });

    it('does not pin npm or yarn projects', () => {
        const npmRepo = makeTree({ 'package.json': '{}', 'package-lock.json': '{}' });
        assert.strictEqual(planInstall({ repoPath: npmRepo, projectDir: npmRepo }).pnpmPin, null);
        const yarnRepo = makeTree({ 'package.json': '{}', 'yarn.lock': '' });
        assert.strictEqual(planInstall({ repoPath: yarnRepo, projectDir: yarnRepo }).pnpmPin, null);
    });

    it('logs and falls back to the corepack default for an unknown lockfile format', () => {
        const repo = makeTree({ 'package.json': '{}', 'pnpm-lock.yaml': "lockfileVersion: '10.0'\n" });
        const plan = planInstall({ repoPath: repo, projectDir: repo });
        assert.strictEqual(plan.pnpmPin, null);
        assert.ok(plan.logLines.some((l) => /unrecognized pnpm-lock.yaml lockfileVersion 10\.0/.test(l)));
    });

    it('writes a pnpm shim that runs the pinned version through corepack', () => {
        const dir = makeTree({});
        const file = writePnpmShim(path.join(dir, 'shims'), '9.15.9');
        assert.strictEqual(file, path.join(dir, 'shims', 'pnpm'));
        assert.strictEqual(fs.readFileSync(file, 'utf8'), '#!/bin/sh\nexec corepack pnpm@9.15.9 "$@"\n');
    });
});

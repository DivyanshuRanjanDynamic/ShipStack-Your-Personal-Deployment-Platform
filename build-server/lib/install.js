const path = require('path');
const {
    readPackageJson,
    detectPackageManagerWithSource,
    isWorkspaceRoot,
    findWorkspaceProtocolDeps,
} = require('./detect');
const { publishStepStart, publishStepEnd } = require('./run-step');

const INSTALL_COMMANDS = {
    npm: 'npm install',
    yarn: 'yarn install --frozen-lockfile',
    pnpm: 'pnpm install --frozen-lockfile',
};

// One retry per manager, and only for the failure it is meant for.
const RETRIES = {
    npm: {
        command: 'npm install --legacy-peer-deps',
        matches: (output) => output.includes('ERESOLVE'),
        message: '[setup] retrying install with --legacy-peer-deps (peer dependency conflict)',
    },
    yarn: {
        command: 'yarn install',
        // yarn 1: "Your lockfile needs to be updated"; yarn 2+: YN0028 "The lockfile would have been modified".
        matches: (output) => /Your lockfile needs to be updated|YN0028|lockfile would have been modified/.test(output),
        message: '[setup] retrying install without --frozen-lockfile (yarn.lock is out of date)',
    },
    pnpm: {
        command: 'pnpm install --no-frozen-lockfile',
        matches: (output) => /ERR_PNPM_OUTDATED_LOCKFILE|ERR_PNPM_LOCKFILE_CONFIG_MISMATCH|ERR_PNPM_NO_LOCKFILE/.test(output),
        message: '[setup] retrying install without --frozen-lockfile (pnpm-lock.yaml is out of date or missing)',
    },
};

/**
 * Decides where and how to install.
 * - Installs from the repo root when it is a workspace root, otherwise in the project folder.
 * - A configured install command replaces detection and retries.
 * - npm cannot install `workspace:` dependencies: UNSUPPORTED_PROJECT.
 *
 * Returns { ok: true, cwd, manager, managerSource, command, retry, logLines }
 *      or { ok: false, failureReason, logLines }.
 */
function planInstall({ repoPath, projectDir, installCommand = null }) {
    const atRoot = projectDir !== repoPath && isWorkspaceRoot(repoPath);
    const cwd = atRoot ? repoPath : projectDir;
    const where = atRoot ? 'repository root (workspace)' : (path.relative(repoPath, projectDir).replace(/\\/g, '/') || '.');
    const { manager, source, ignored } = detectPackageManagerWithSource(cwd);
    const logLines = [];
    if (ignored) logLines.push(`[setup] packageManager "${ignored}" is not supported; detecting from lockfiles`);

    if (installCommand) {
        logLines.push(`[setup] install command: ${installCommand} (source: project setting, in ${where})`);
        return { ok: true, cwd, manager, managerSource: source, command: installCommand, retry: null, logLines };
    }

    logLines.push(`[setup] package manager: ${manager} (source: ${source})`);
    if (manager === 'npm') {
        const workspaceDeps = findWorkspaceProtocolDeps(path.resolve(repoPath));
        if (workspaceDeps.length > 0) {
            logLines.push(`[setup] dependencies use the workspace: protocol, which npm cannot install: ${workspaceDeps.slice(0, 5).join(', ')}${workspaceDeps.length > 5 ? ', ...' : ''}`);
            logLines.push('[setup] this repository needs pnpm or yarn; commit its lockfile (pnpm-lock.yaml or yarn.lock) or set "packageManager" in package.json');
            return { ok: false, failureReason: 'UNSUPPORTED_PROJECT', logLines };
        }
    }

    const command = INSTALL_COMMANDS[manager];
    logLines.push(`[setup] install command: ${command} (in ${where})`);
    return { ok: true, cwd, manager, managerSource: source, command, retry: RETRIES[manager], logLines };
}

/**
 * Runs the install step: one attempt, plus the manager's single retry when the first attempt's
 * output matches it. The step is framed once, so a recovered first attempt is not reported as failed.
 * `run(command)` resolves to { exitCode, tail }. Resolves to { ok, exitCode, attempts }.
 */
async function runInstall({ plan, run, logSink }) {
    await publishStepStart(logSink, 'install');
    let { exitCode, tail } = await run(plan.command);
    let attempts = 1;
    if (exitCode !== 0 && plan.retry && plan.retry.matches(tail)) {
        await logSink.publish({ log: plan.retry.message, step: 'install' });
        ({ exitCode } = await run(plan.retry.command));
        attempts = 2;
    }
    await publishStepEnd(logSink, 'install', exitCode, 'NONZERO_EXIT');
    return { ok: exitCode === 0, exitCode, attempts };
}

/**
 * Build command: the configured one, otherwise `<manager> run build` when a build script exists.
 * Without either, MISSING_BUILD_SCRIPT (no guessing, no `npx vite build`).
 */
function planBuild({ projectDir, manager, buildCommand = null }) {
    if (buildCommand) {
        return { ok: true, command: buildCommand, logLines: [`[setup] build command: ${buildCommand} (source: project setting)`] };
    }
    const pkg = readPackageJson(projectDir) || {};
    if (pkg.scripts && pkg.scripts.build) {
        const command = `${manager} run build`;
        return { ok: true, command, logLines: [`[setup] build command: ${command} (source: "build" script)`] };
    }
    return {
        ok: false,
        failureReason: 'MISSING_BUILD_SCRIPT',
        logLines: [
            '[setup] package.json has no "build" script, so there is nothing to build',
            '[setup] add a "build" script to package.json, or set a build command in the project build settings',
        ],
    };
}

module.exports = { INSTALL_COMMANDS, RETRIES, planInstall, runInstall, planBuild };

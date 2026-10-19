const path = require('path');
const {
    readPackageJson,
    detectFramework,
    detectPackageManager,
    hasLockfile,
} = require('./detect');

/**
 * Builds the build-context.json document (schema: ai-service/contracts/build-context.ts).
 * Never include env var values.
 */
function createBuildContext({ projectDir, deploymentId, gitUrl, buildCommand, expectedOutputDir, nodeVersion = process.version, now = new Date() }) {
    const pkg = readPackageJson(projectDir) || {};
    return {
        deployment_id: deploymentId,
        git_url: gitUrl,
        framework: detectFramework(pkg),
        package_manager: detectPackageManager(projectDir),
        node_version: nodeVersion,
        engines: pkg.engines || null,
        scripts: pkg.scripts || null,
        build_command: buildCommand,
        expected_output_dir: expectedOutputDir,
        has_lockfile: hasLockfile(projectDir),
        captured_at: now.toISOString()
    };
}

function buildContextKey(deploymentId) {
    return path.posix.join('__meta', deploymentId, 'build-context.json');
}

// Upload failures are logged, never fatal.
async function uploadBuildContext({ objectSink, context }) {
    try {
        await objectSink.put(buildContextKey(context.deployment_id), JSON.stringify(context), 'application/json');
        console.log('Build context uploaded');
    } catch (err) {
        console.error('Failed to upload build context:', err);
    }
}

module.exports = { createBuildContext, buildContextKey, uploadBuildContext };

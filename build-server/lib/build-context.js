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
function createBuildContext({
    projectDir,
    installDir = projectDir,
    packageManager = null,
    deploymentId,
    gitUrl,
    buildCommand,
    expectedOutputDir,
    nodeVersion = process.version,
    rootDirectory = null,
    installCommand = null,
    nodeSelectedFrom = null,
    legacyOpenSSL = false,
    outputDirResolved = null,
    now = new Date(),
}) {
    const pkg = readPackageJson(projectDir) || {};
    return {
        deployment_id: deploymentId,
        git_url: gitUrl,
        framework: detectFramework(pkg),
        package_manager: packageManager || detectPackageManager(installDir),
        node_version: nodeVersion,
        engines: pkg.engines || null,
        scripts: pkg.scripts || null,
        build_command: buildCommand,
        expected_output_dir: expectedOutputDir,
        has_lockfile: hasLockfile(installDir),
        captured_at: now.toISOString(),
        // Truthful, resolved details (Step 9). Never include env var values.
        root_directory: rootDirectory,
        install_command: installCommand,
        node_selected_from: nodeSelectedFrom,
        legacy_openssl: legacyOpenSSL,
        output_dir_resolved: outputDirResolved,
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

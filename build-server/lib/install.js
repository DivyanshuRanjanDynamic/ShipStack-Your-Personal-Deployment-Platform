function resolveInstallCommand() {
    return 'npm install';
}

// `npm run build` when the package defines a build script, otherwise the Vite fallback.
function resolveBuildCommand(pkg) {
    if (!pkg || !pkg.scripts || !pkg.scripts.build) return 'npx vite build';
    return 'npm run build';
}

module.exports = { resolveInstallCommand, resolveBuildCommand };

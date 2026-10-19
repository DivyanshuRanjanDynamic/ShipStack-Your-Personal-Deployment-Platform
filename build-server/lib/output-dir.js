const fs = require('fs');
const path = require('path');

// Returns the build output folder (`dist`, then `build`), or null if neither exists.
function findOutputDir(projectDir) {
    for (const name of ['dist', 'build']) {
        const candidate = path.join(projectDir, name);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

module.exports = { findOutputDir };

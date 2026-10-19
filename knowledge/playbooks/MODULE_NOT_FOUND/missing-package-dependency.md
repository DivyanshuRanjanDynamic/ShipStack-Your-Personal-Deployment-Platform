---
id: shipstack-missing-package-dependency
title: Missing Package in package.json Dependencies
category: MODULE_NOT_FOUND
framework: []
packageManager: []
symptoms:
  - Error: Cannot find module '<package-name>'
  - Module not found: Error: Can't resolve '<package-name>'
  - Failed to compile in build step
errorSignatures:
  - "Error: Cannot find module"
  - "Module not found: Error: Can't resolve"
  - "Failed to compile"
appliesTo: "npm/yarn/pnpm installations missing required runtime packages"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

The application imports a third-party npm package that is not declared in `package.json` under either `dependencies` or `devDependencies`. While the package might have been installed globally or present in a local parent `node_modules` during local development, clean container builds on ShipStack start from an empty directory and will fail to resolve the package.

## Remediation on ShipStack

1. **Add Missing Package**: Run `npm install <package-name>` (or `npm install --save-dev <package-name>` if only used at build time).
2. **Commit package.json and Lockfile**: Ensure both `package.json` and `package-lock.json` (or `pnpm-lock.yaml` / `yarn.lock`) are committed and pushed to the Git repository.
3. **Verify DevDependencies**: Ensure packages required for building (such as TypeScript, build plugins, or CSS processors) are not excluded by production-only install flags.

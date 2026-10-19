---
id: vite-rollup-module-resolution
title: Vite and Rollup Module Resolution and Missing Imports
category: MODULE_NOT_FOUND
framework:
  - vite
packageManager: []
symptoms:
  - Rollup failed to resolve import
  - Could not resolve module path
  - Module build failed
errorSignatures:
  - "Rollup failed to resolve import"
  - "Could not resolve"
  - "Failed to resolve import"
  - "Cannot find module"
appliesTo: "Vite build step using Rollup bundler"
sources:
  - url: https://github.com/vitejs/vite/blob/v5.4.8/docs/guide/troubleshooting.md#module-resolution
    license: "MIT"
    commitSha: "9e403d1"
    retrievedAt: 2026-10-17
reviewed: true
---

## Official Documentation (Vite Guide: Troubleshooting)

When Vite builds for production, it invokes Rollup to bundle client assets. If a module cannot be resolved during this bundling phase, Rollup emits a `Rollup failed to resolve import` error.

### Common Causes & Official Remediation

1. **Uninstalled Dependency**: The package is imported in source code but is missing from `dependencies` in `package.json`. Add the package via `npm install <package-name>`.
2. **Path Aliasing**: If an import uses path aliases (such as `@/components/...`), ensure the alias is explicitly defined in `vite.config.js` under `resolve.alias` matching the TypeScript `paths` configuration in `tsconfig.json`.
3. **File Extension or Casing**: Rollup requires relative imports targeting local files to include valid extensions or match the exact filename on disk. On case-sensitive operating systems, mismatched uppercase/lowercase characters will cause resolution to fail.

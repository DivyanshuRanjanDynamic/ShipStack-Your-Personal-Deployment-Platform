continue---
id: shipstack-code-error-typescript
title: TypeScript Typecheck Errors and Code Compilation Failures
category: CODE_ERROR
framework: []
packageManager: []
symptoms:
  - tsc -b exits with error code 1 or 2
  - TS2304 / TS2307 / TS2322 type errors in build log
  - Treating warnings as errors because process.env.CI = true
errorSignatures:
  - "error TS"
  - "tsc exited with"
  - "Type error:"
  - "Treating warnings as errors"
appliesTo: "TypeScript and JavaScript build compilation on ShipStack"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

Many modern project templates configure the `"build"` script to execute TypeScript validation before bundling (e.g. `"build": "tsc -b && vite build"`). If any type errors exist in the repository, `tsc` exits with a non-zero exit code, causing the overall build step to fail before bundling begins. In Create React App, `CI=true` causes ESLint warnings to be treated as fatal errors.

## Remediation on ShipStack

1. **Fix Type Errors**: Inspect the specific TypeScript diagnostics reported in the build log (e.g. `TS2322: Type 'X' is not assignable to type 'Y'`) and correct the offending code.
2. **Run Local Typecheck**: Verify all errors are resolved locally by running `npx tsc --noEmit` before pushing to Git.
3. **Handle CI Warnings for CRA**: For Create React App repositories where linter warnings halt the build, set `CI=false` in ShipStack Project Settings > Environment Variables or address the lint warnings.

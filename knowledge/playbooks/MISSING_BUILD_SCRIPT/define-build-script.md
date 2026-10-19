---
id: shipstack-missing-build-script
title: Missing Build Script in package.json
category: MISSING_BUILD_SCRIPT
framework: []
packageManager: []
symptoms:
  - npm ERR! Missing script: "build"
  - yarn run: error Command "build" not found
  - Build step fails immediately before executing compiler
errorSignatures:
  - "Missing script: \"build\""
  - "missing script: build"
  - "npm ERR! Missing script"
  - "Command \"build\" not found"
appliesTo: "package.json scripts field on ShipStack build execution"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

ShipStack's default build step executes `npm run build`. If the repository's `package.json` does not declare a `"build"` key under `"scripts"`, the package runner halts with `Missing script: "build"`.

## Remediation on ShipStack

1. **Add Build Script to package.json**:
   ```json
   {
     "scripts": {
       "build": "vite build"
     }
   }
   ```
   (Replace `vite build` with `react-scripts build`, `next build`, or your specific build tool).
2. **Or Customize Build Command**: In the ShipStack Project Settings > Build Settings, override the default build command to match your project's custom command (e.g. `npm run compile`).
3. **Commit and Push**: Ensure the modified `package.json` is committed to Git and trigger a new deployment.

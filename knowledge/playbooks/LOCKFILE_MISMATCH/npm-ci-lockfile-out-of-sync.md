---
id: shipstack-lockfile-mismatch
title: Lockfile Out of Sync with package.json
category: LOCKFILE_MISMATCH
framework: []
packageManager:
  - npm
  - yarn
  - pnpm
symptoms:
  - npm ci fails because package-lock.json is out of sync
  - yarn.lock or pnpm-lock.yaml does not match dependencies in package.json
  - cipm can only install packages when your package.json and package-lock.json are in sync
errorSignatures:
  - "npm ci"
  - "can only install packages when your package.json and package-lock.json are in sync"
  - "out of sync"
  - "This command requires an existing lockfile"
appliesTo: "npm ci, pnpm install --frozen-lockfile, and yarn install --immutable"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

Clean CI/CD build environments often execute `npm ci` (or `pnpm install --frozen-lockfile`) for reproducible installs. If `package.json` was updated (for example, adding or upgrading a dependency) without regenerating and committing the corresponding lockfile (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`), `npm ci` detects the discrepancy and immediately terminates installation.

## Remediation on ShipStack

1. **Regenerate Lockfile Locally**: Run `npm install` (or `pnpm install` / `yarn install`) locally in the project repository to update the lockfile.
2. **Commit the Lockfile**: Commit the updated lockfile together with `package.json` to Git:
   ```bash
   git add package.json package-lock.json
   git commit -m "fix: update package-lock.json"
   git push
   ```
3. **Alternatively Use Standard Install**: In ShipStack Project Settings > Build Settings, adjust the install command from `npm ci` to `npm install` if rapid prototyping is preferred.

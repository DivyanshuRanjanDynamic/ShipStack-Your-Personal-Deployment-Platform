---
id: shipstack-npm-peer-deps
title: Resolving Peer Dependency Conflicts on ShipStack
category: DEPENDENCY_CONFLICT
framework: []
packageManager:
  - npm
symptoms:
  - npm install fails in builder container with ERESOLVE
  - conflicting peer dependencies in package-lock.json
errorSignatures:
  - "ERESOLVE"
  - "unable to resolve dependency tree"
  - "Conflicting peer dependency"
appliesTo: "npm install build step on ShipStack container environment"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

ShipStack builds execute inside isolated Linux container tasks running standard `npm install`. When a project or its transitive dependencies declare conflicting peer dependency versions, modern npm fails with `ERESOLVE`.

## Remediation on ShipStack

1. **Update package.json**: Align versions of the conflicting dependencies to a shared compatible release. For example, upgrade or downgrade the peer dependency to match the range requested by the parent package.
2. **Re-generate lockfile**: Locally run `npm install` and commit the updated `package-lock.json` to the git repository.
3. **Configure `--legacy-peer-deps`**: If upstream dependencies cannot be immediately updated, add `legacy-peer-deps=true` to an `.npmrc` file in the project root, or set the install command in ShipStack project build settings to `npm install --legacy-peer-deps`.

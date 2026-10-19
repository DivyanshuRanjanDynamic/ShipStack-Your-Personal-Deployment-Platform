---
id: shipstack-configure-node-version
title: Configuring Node.js Version for ShipStack Deployments
category: NODE_VERSION_MISMATCH
framework: []
packageManager: []
symptoms:
  - Unsupported engine during install or build step
  - requires Node >= but environment runs an older version
  - Node syntax error like unexpected token '?' (optional chaining) on old Node
errorSignatures:
  - "Unsupported engine"
  - "requires Node >="
  - "does not satisfy the version"
  - "engines.node"
appliesTo: "Node.js runtime environment selection on ShipStack"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

ShipStack uses a default Node.js version in builder container environments (e.g., Node 18 or 20). If a project specifies an incompatible version constraint in `package.json` (`"engines": { "node": ">=22" }`) or uses language features unsupported by older versions, dependencies will fail to install or the build will crash.

## Remediation on ShipStack

1. **Configure in ShipStack Settings**: Navigate to the Project Settings page in the ShipStack dashboard and select the matching Node.js runtime version (e.g., Node 20.x, 22.x).
2. **Specify .nvmrc or .node-version**: Place an `.nvmrc` or `.node-version` file containing the desired version (e.g. `20`) in the root of your Git repository.
3. **Adjust package.json Engines**: If the project can run on the deployed Node version, relax the semver range in `package.json` under `engines.node`.

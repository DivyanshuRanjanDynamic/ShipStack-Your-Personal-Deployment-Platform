---
id: shipstack-client-env-prefixes
title: Missing Environment Variable or Unprefixed Client Variables
category: MISSING_ENV_VAR
framework:
  - vite
  - cra
  - next
packageManager: []
symptoms:
  - Build fails with undefined environment variable
  - Runtime API endpoint is undefined or empty string
  - Process.env variable not embedded in client bundle
errorSignatures:
  - "is not defined"
  - "missing required environment variable"
  - "process.env"
appliesTo: "Environment variable injection on ShipStack client builds"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

Frontend bundlers do not expose server-side environment variables to browser code for security reasons. Instead, only variables with framework-specific prefixes are embedded into client bundles at build time:
- **Vite**: Variables must start with `VITE_` (e.g. `VITE_API_URL`) and accessed via `import.meta.env.VITE_API_URL`.
- **Create React App**: Variables must start with `REACT_APP_` (e.g. `REACT_APP_API_URL`).
- **Next.js**: Client-accessible variables must start with `NEXT_PUBLIC_`.

If an environment variable is omitted or lacks the expected prefix, it evaluates to `undefined` during the build or at runtime.

## Remediation on ShipStack

1. **Add to ShipStack Project Settings**: Go to Project Settings > Environment Variables in the ShipStack dashboard and add the missing key and value.
2. **Apply Required Prefix**: Ensure client variables are named with the appropriate prefix (`VITE_`, `REACT_APP_`, or `NEXT_PUBLIC_`).
3. **Trigger Redeployment**: After saving project environment variables, trigger a new deployment to embed them into the static build.

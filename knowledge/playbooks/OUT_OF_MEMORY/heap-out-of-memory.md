---
id: shipstack-out-of-memory
title: JavaScript Heap Out of Memory or Container OOM Kill
category: OUT_OF_MEMORY
framework: []
packageManager: []
symptoms:
  - Fatal process out of memory: JavaScript heap out of memory
  - Container exited with code 137 (SIGKILL)
  - Build crashes during asset optimization or bundle generation
errorSignatures:
  - "JavaScript heap out of memory"
  - "exit code 137"
  - "FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed"
  - "Killed"
appliesTo: "Memory-intensive builds on ShipStack container tasks"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

Large frontends with heavy bundle splitting, sourcemaps, or monolithic typechecking may exceed the default V8 heap allocation (typically ~2 GB on 64-bit systems) or the memory limit of the container task, causing either Node.js to abort with `JavaScript heap out of memory` or the Linux kernel OOM-killer to terminate the process with exit code 137.

## Remediation on ShipStack

1. **Increase V8 Node Heap Size**: Add the `NODE_OPTIONS` environment variable in ShipStack Project Settings > Environment Variables:
   ```
   NODE_OPTIONS=--max-old-space-size=4096
   ```
2. **Disable Production Sourcemaps**: Large sourcemap generation consumes massive RAM during bundling. Set `build: { sourcemap: false }` in `vite.config.js` or `GENERATE_SOURCEMAP=false` for Create React App.
3. **Upgrade Task Resource Allocation**: If the container itself exceeds allocated RAM, adjust task memory configuration in the ShipStack infrastructure settings.

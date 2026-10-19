---
id: shipstack-output-directory-mismatch
title: Build Succeeds but Upload Step Finds No Files (Output Directory Mismatch)
category: WRONG_OUTPUT_DIR
framework:
  - vite
  - cra
  - next
packageManager: []
symptoms:
  - Build command completes successfully with exit code 0
  - Upload step reports no files found or output folder does not exist
  - Deployed site returns 404 or empty directory
errorSignatures:
  - "no files found"
  - "Output directory does not exist"
  - "Directory not found for upload"
  - "dist does not exist"
appliesTo: "Static site output directory configuration on ShipStack"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

Different frontend frameworks build production assets into different output directory names:
- **Vite**: defaults to `dist`
- **Create React App**: defaults to `build`
- **Next.js static export**: defaults to `out`
- **Astro**: defaults to `dist`

If ShipStack project settings expect `dist` but your framework outputs to `build` (or vice-versa), the upload worker searches the wrong directory and fails to find any generated files.

## Remediation on ShipStack

1. **Update Output Directory in Project Settings**: In the ShipStack dashboard under Project Settings > Build Settings, set the **Output Directory** to match your framework (`dist`, `build`, or `out`).
2. **Alternatively Configure Bundler**:
   - In `vite.config.js`: specify `build: { outDir: 'dist' }`.
   - In `next.config.js`: specify `output: 'export'` for static HTML export.

---
id: shipstack-linux-case-sensitivity
title: Module Resolution Failure Due to File Casing on Linux
category: MODULE_NOT_FOUND
framework: []
packageManager: []
symptoms:
  - Project builds successfully on developer machine but fails on ShipStack
  - Cannot find module or file path during bundling
  - ENOENT or Failed to resolve import
errorSignatures:
  - "Cannot find module"
  - "Can't resolve"
  - "Failed to resolve import"
  - "Module not found"
appliesTo: "All frameworks compiling on Linux container filesystem"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

Developer workstations on macOS and Windows typically use case-insensitive filesystems (APFS/NTFS), where `import Button from './button'` successfully finds `Button.jsx`. ShipStack builder containers run on Linux (ext4/overlayfs), which enforces strict case-sensitivity. Any discrepancy between the import path and the actual file path on disk results in an immediate module resolution failure.

## Remediation on ShipStack

1. **Verify Exact Filename**: Check the source file in Git and verify every uppercase and lowercase character matches the import statement (e.g. `Navbar.tsx` vs `navbar.tsx`).
2. **Fix Git Renaming**: If a file was renamed with only case changes (e.g. `header.jsx` -> `Header.jsx`), Git on Windows/macOS may not detect the change. Run `git mv -f header.jsx Header.jsx` and commit.
3. **Verify Relative Path Extensions**: Ensure relative imports (`./`, `../`) point to the intended directory hierarchy.

---
id: npm-eresolve-peer-deps
title: npm ERESOLVE Could Not Resolve Dependency Tree
category: DEPENDENCY_CONFLICT
framework: []
packageManager:
  - npm
symptoms:
  - npm error code ERESOLVE
  - Conflicting peer dependency
  - Could not resolve dependency
  - While resolving dependency tree
errorSignatures:
  - "npm error code ERESOLVE"
  - "ERESOLVE could not resolve"
  - "Conflicting peer dependency"
  - "peer dependency conflict"
appliesTo: "npm v7+ strict peer dependency resolution"
sources:
  - url: https://github.com/npm/cli/blob/v10.8.2/docs/content/using-npm/config.md#legacy-peer-deps
    license: "Artistic-2.0"
    commitSha: "8a15b3c"
    retrievedAt: 2026-10-17
reviewed: true
---

## Official Documentation (npm CLI)

In npm versions 7 and higher, peer dependencies are installed by default. If conflicting peer dependency versions are requested across direct dependencies and transitive dependencies, the dependency graph cannot be resolved automatically, and npm terminates installation with error code `ERESOLVE`.

### Resolving Peer Dependency Conflicts

1. **Align Dependency Versions**: Inspect the conflicting packages listed in the `ERESOLVE` output. Update direct dependencies in `package.json` to versions that declare overlapping or compatible peer dependency ranges.
2. **Use `--legacy-peer-deps`**: Instructs npm to bypass the peer dependency installation algorithm introduced in npm v7, reverting to the npm v4-v6 behavior where peer dependencies are ignored rather than strictly validated.
3. **Use `--force`**: Tells npm to force installation despite conflicts, which may result in multiple conflicting packages coexisting or unexpected runtime errors.

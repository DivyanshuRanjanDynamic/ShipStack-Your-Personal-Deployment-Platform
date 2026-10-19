---
id: node-engines-specification
title: Node.js Engines Field and Runtime Compatibility
category: NODE_VERSION_MISMATCH
framework: []
packageManager: []
symptoms:
  - Unsupported engine
  - Not compatible with your operating system or Node.js version
  - requires Node >=
errorSignatures:
  - "Unsupported engine"
  - "npm ERR! notsup"
  - "requires Node >="
  - "incompatible node"
appliesTo: "package.json engines field validation during package install"
sources:
  - url: https://github.com/nodejs/node/blob/v20.18.0/doc/api/packages.md#nodejs-runtime
    license: "MIT"
    commitSha: "f6b219a"
    retrievedAt: 2026-10-17
reviewed: true
---

## Official Documentation (Node.js & npm Package Specification)

The `engines` property in `package.json` specifies the version ranges of Node.js and package managers with which the application or package is designed to work:

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Engine Warnings vs Strict Enforcement

1. **npm Engine Behavior**: By default, npm prints a warning (`Unsupported engine`) if the current runtime does not satisfy the `engines` field. If `engine-strict=true` is set (or configured in `.npmrc`), npm halts installation with an error code `EBADENGINE` or `ENOTSUP`.
2. **Remediation**: Either update the Node.js runtime environment to a version matching the constraint, or adjust the `engines` semver range in `package.json` if the code is compatible with the installed Node version.

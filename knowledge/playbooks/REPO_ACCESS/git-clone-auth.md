---
id: shipstack-repo-access-git
title: Git Repository Clone Failure or Authentication Required
category: REPO_ACCESS
framework: []
packageManager: []
symptoms:
  - Repository not found or fatal authentication failed during clone
  - could not read Username for 'https://github.com'
  - Permission denied (publickey)
errorSignatures:
  - "Repository not found"
  - "fatal: Authentication failed"
  - "could not read Username"
  - "fatal: repository"
appliesTo: "Git clone step in ShipStack builder task"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

The clone step fails when ShipStack cannot reach the Git repository. Common triggers include:
1. The repository is private and no GitHub Personal Access Token (PAT) or deploy key was configured for ShipStack.
2. The Git URL is misspelled or the repository was renamed/deleted on the hosting provider.
3. Access tokens have expired or lack the `repo` read scope.

## Remediation on ShipStack

1. **Verify Repository URL**: Check the project's Git URL in Project Settings and verify it can be cloned without credentials in a browser or terminal.
2. **Configure Access Token for Private Repos**: In ShipStack Settings > Integrations, link your GitHub account or provide a Personal Access Token with read access to the target repository.
3. **Verify Organization SSO**: If the repository belongs to a GitHub Organization with SAML Single Sign-On (SSO), ensure the access token is authorized for that organization.

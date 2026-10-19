---
id: shipstack-unsupported-project-ssr
title: Unsupported Project: Server-Side Rendering (SSR) Without Static Export
category: UNSUPPORTED_PROJECT
framework:
  - next
packageManager: []
symptoms:
  - Repository contains Node server routes or getServerSideProps
  - Project requires persistent Node.js server rather than static HTML/JS
  - No package.json found in repository root
errorSignatures:
  - "getServerSideProps"
  - "not a static site"
  - "server-side rendering"
  - "No package.json found"
appliesTo: "Non-static repositories deployed to ShipStack static hosting"
sources:
  - url: https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform/blob/60f183f/phase0.md
    license: "Apache-2.0"
    commitSha: "60f183f"
    retrievedAt: 2026-10-17
reviewed: true
---

## Cause

ShipStack is an optimized deployment platform for static frontend single-page applications and statically generated sites (HTML, CSS, JavaScript). It does not run dynamic Node.js / Express servers or Next.js server-side rendering (SSR) lambdas. If a repository requires dynamic server-side runtime features (`getServerSideProps`, API routes, Express listener) without producing static HTML export assets, deployment cannot proceed.

## Remediation on ShipStack

1. **Configure Next.js Static Export**: If using Next.js, enable static HTML export in `next.config.js`:
   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'export',
   };
   module.exports = nextConfig;
   ```
2. **Replace SSR with Client-Side Data Fetching**: Convert server-rendered pages using `getServerSideProps` to static generation with `getStaticProps` or client-side fetch calls (e.g. `useEffect` or SWR/React Query).
3. **Verify Root Directory**: If the static frontend is located in a subdirectory (e.g., in a monorepo), specify the Root Directory in ShipStack Project Settings.

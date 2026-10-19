# Build-server fixes: completion report

> Companion to `BUILD-SERVER-FIXES.md` (the spec). Branch: `build-server-fixes`.
> Status: implementation complete through Step 9. Nothing was pushed to any registry and no AWS
> resource was created, modified or deleted. The container image was only built locally.

## 1. What changed

The build-server was a single `script.js` that ran every repo the same way. It is now a small set
of tested modules with a local run mode, honest failure handling, and per-project settings.

### build-server (`build-server/`)
- **`script.js`** is orchestration only.
- **`lib/`**: `sinks.js` (Kafka/S3 vs stdout/folder), `run-step.js` (spawn + output tail + per-line
  publishing), `log-lines.js` (line buffer), `detect.js` (framework, package manager, root-dir
  scoring, `workspace:`), `install.js` (package-manager-aware install, ERESOLVE retry, build
  command), `node-version.js` (Node selection + legacy OpenSSL), `output-dir.js` (output detection
  + Next.js), `upload.js` (concurrent, retrying, honest), `env.js` (child-env allowlist +
  `USER_ENV_JSON`), `settings.js` (re-validate `BUILD_*` / `NODE_VERSION`), `build-context.js`.
- **`Dockerfile`**: `ubuntu:24.04`; Node 16/18/20/22 from checksum-verified tarballs; corepack
  updated to a current version; non-root `appuser` and `kafka.pem` unchanged.
- **`test/`**: `node:test`, no network. 158 tests.

### api-server (`api-server/`)
- `src/task-env.js` — serializes user env vars into one `USER_ENV_JSON` (6 KB cap).
- `src/build-settings.js` — zod validation of the typed settings + `BUILD_*` env builder.
- `src/deployment-status.js` — status transitions honored only from platform log lines.
- `index.js` — passes `USER_ENV_JSON` and `BUILD_*`/`NODE_VERSION` on RunTask; `POST /project`
  stores typed settings; new `PATCH /project/:id/build-settings`; `/logs/:id` orders by `seq`.
- Prisma: five nullable `Project` columns + migration `20261019000000_add_project_build_settings`.
- 50 tests.

### ai-service (`ai-service/`)
- `contracts/steps.ts` — new failure reasons `UNSUPPORTED_PROJECT`, `UPLOAD_FAILED`,
  `MISSING_BUILD_SCRIPT`, `ROOT_DIR_AMBIGUOUS`.
- `contracts/build-context.ts` — extended framework enum; new nullable truthful fields.
- `src/pipeline/fetchContext.ts` — log fetch orders by `(seq, timestamp)`.

### frontend (`frontend/`)
- Create form and project **Settings** tab use the typed settings (blank = auto-detect), add a
  Node Version selector, and edit settings via `PATCH /project/:id/build-settings`.

## 2. How to run a build locally (no AWS, no Kafka, no S3)

```bash
cd build-server
docker build -t shipstack-build-server:local .
# Clone a repo and run it; outputs land under $OUT, logs go to stdout.
docker run --rm \
  -e LOCAL_RUN=1 \
  -e DEPLOYMENT_ID=dev-1 \
  -e GIT_REPOSITORY_URL=https://github.com/owner/repo \
  -e LOCAL_OUTPUT_DIR=/out \
  -v "$PWD/local-output:/out" \
  shipstack-build-server:local
```

`LOCAL_RUN=1` uses the stdout log sink and a folder object sink; it never reads `kafka.pem`, never
creates an S3 client, and needs no credentials. Settings can be exercised with
`-e BUILD_ROOT_DIR=... -e NODE_VERSION=18 -e BUILD_OUTPUT_DIR=...`, and user env vars with
`-e USER_ENV_JSON='{"KEY":"value"}'`.

Run the unit tests:

```bash
cd build-server && npm test     # 158 pass
cd ../api-server && npm test     # 50 pass
cd ../ai-service && npx vitest run contracts   # 18 pass
```

## 3. Acceptance matrix (local run on the final image)

Every row was run with `LOCAL_RUN=1` on the locally built image. Real GitHub repos are cloned over
the network; fixtures are small local git repos (and, where a public repo for the case did not
exist, purpose-built: Vite, engines, pnpm workspace, two-frontends, Next export, stale-dist,
secret-probe, no-build-script).

| Repo type | Expected | Result | Evidence |
|-----------|----------|--------|----------|
| Vite + React (regression) | Deploys as before | ✅ PASS | `output directory: dist`, `upload:end exit_code=0` |
| CRA `react-scripts` 4 on default Node (mern-admin frontend) | Deploys; legacy OpenSSL logged | ✅ PASS | `appending --openssl-legacy-provider…`, `Compiled successfully.`, `output directory: build` |
| App with `engines` for an older Node (fixture 18.x) | Builds on that Node | ✅ PASS | `node 18.20.5 selected (source: .nvmrc / .node-version)`, build-context `node_version: 18.20.5` |
| ERESOLVE repo (Cryptoverse) | Deploys after logged retry | ✅ PASS | `retrying install with --legacy-peer-deps`, `output directory: build`, exit 0 |
| pnpm monorepo with `workspace:` deps (fixture) | Deploys with pnpm from root | ✅ PASS | `package manager: pnpm`, `pnpm install --frozen-lockfile (in repository root (workspace))`, `output directory: dist` |
| MERN repo (`backend/` + `frontend/`) (mern-admin) | Frontend selected; deploys | ✅ PASS | `root directory: frontend (reason: build script + react)` |
| Two plausible frontends (fixture) | `ROOT_DIR_AMBIGUOUS` | ✅ PASS | `2 folders are equally likely to be the frontend`, `failure_reason=ROOT_DIR_AMBIGUOUS` |
| Next.js `output: 'export'` (fixture) | Deploys from `out/` | ✅ PASS | `output directory: out`, exit 0 |
| Next.js server rendering (quickbills) | `UNSUPPORTED_PROJECT` + static-export help | ✅ PASS | `this app needs a Node server…`, `set output: 'export'…`, `failure_reason=UNSUPPORTED_PROJECT` |
| Committed stale `dist/` + real build into `build/` (fixture) | Uploads `build/` | ✅ PASS | `output directory: build`; uploaded index.html = "freshly built" |
| Forced S3 failure (read-only output) | `UPLOAD_FAILED`; deployment failed | ✅ PASS | `failed to upload … after 3 attempts`, `2 file(s) failed to upload`, `failure_reason=UPLOAD_FAILED` |
| `postinstall` printing platform secrets (fixture) | Secrets absent from the log | ✅ PASS | `PROBE KAFKA_PASSWORD=[]`, `PROBE ECS_SECRET_ACCESSKEY=[]`; no secret value in the log |
| Repo with no build script (fixture) | `MISSING_BUILD_SCRIPT` | ✅ PASS | `package.json has no "build" script…`, `failure_reason=MISSING_BUILD_SCRIPT` |

**One ECS run per row (production path): UNVERIFIED.** Running on ECS needs the pushed image and a
task-definition revision, which the owner does manually (section 5). The logic that differs between
local and production is only the sink implementations (Kafka vs stdout, S3 vs folder), both unit
tested.

## 4. Known gaps / UNVERIFIED

- **ECS production runs** — UNVERIFIED (owner pushes the image; see section 5).
- **ClickHouse `seq` write/read** — UNVERIFIED locally (no ClickHouse instance here). The migration
  (`clickhouse-seq.sql`) is additive and the consumer defaults `seq` to 0, so old rows keep working.
- **Angular `dist/<app>/browser` and Nuxt `.output/public`** — covered by unit tests only; no real
  Angular/Nuxt repo was available, so a real build is UNVERIFIED.
- **Node 16 + corepack** — `corepack@latest` needs Node 18+, so Node 16 keeps its bundled corepack;
  corepack-managed pnpm/yarn on Node 16 may fail. Node 16 projects almost always use npm.
- **Shared output prefix (spec §11)** — the reverse proxy serves `__outputs/{projectId}/`, shared by
  every deployment. Honest upload prevents a *successful* deployment with missing files, but a
  *partial* upload still overwrites part of the live site in place. Recommended as a **separate**
  change: write each deployment to `__outputs/{projectId}/{deploymentId}/`, store an active
  deployment id, switch it atomically after a fully successful upload, resolve it in the proxy, and
  prune old prefixes. Not done here (storage redesign).
- **Residual sandboxing (spec §12)** — user code still runs as `appuser` and can read container
  files (including `kafka.pem`) and reach the network. Recommended follow-ups: run install/build as
  a separate unprivileged user or second container, and replace static S3 keys with an ECS task role.
- **`prisma generate`** could not run in this environment (the running api-server held the query
  engine DLL). The schema is valid and the migration applied cleanly to a throwaway local DB; the
  client regenerates on the next `npm install`/restart.

## 5. Manual steps for the owner (not done by code or agents)

Apply in this order so each service understands what the previous one emits:

1. **Review the new Dockerfile.** Build the image locally and smoke-test with `LOCAL_RUN=1`.
2. **ClickHouse:** apply `docs/build-server/clickhouse-seq.sql` to your ClickHouse database (a local
   database first). This adds the `seq` column the new consumer writes.
3. **Prisma:** apply the new migration to your Postgres
   (`npx prisma migrate deploy`), then `npx prisma generate`, then restart the api-server.
4. **Deploy the ai-service** with the new failure-reason enum before the api-server starts publishing
   those reasons.
5. **Deploy the api-server** (new consumer, `USER_ENV_JSON`, settings, `seq` ordering).
6. **Push the image** to the registry and **register a new ECS task definition revision** pointing at
   it (AWS console). Update `ECS_TASK_DEFINITION` (or the revision the api-server uses).
7. **Optional hardening:** create an ECS task role with S3 write access to the bucket and remove the
   static S3 keys from the task environment.
8. After rollout, **stop any test tasks** left running in the ECS console.

## 6. Definition of done (spec §20)

- [x] Every acceptance-matrix row passes with evidence, or is marked UNVERIFIED with the reason
      (ECS production runs; see section 4).
- [x] Unit tests pass; existing tests pass; the previously working Vite and CRA flows are unchanged.
- [x] No platform secret is visible to user build scripts (tested — secret-probe row).
- [x] A failed upload never produces a successful deployment (tested — forced-failure row).
- [x] Evidence line numbers can equal UI row numbers (one Kafka message per line with `seq`;
      ClickHouse write UNVERIFIED locally).
- [x] `build-context.json` reports the real output directory, Node version and root directory.
- [x] No AWS resource or `docker push` was touched by the implementation.

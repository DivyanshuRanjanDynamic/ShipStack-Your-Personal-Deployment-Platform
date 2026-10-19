# Build-server fixes: make real-world repos deploy

> Location in repo: `docs/build-server/BUILD-SERVER-FIXES.md`
> Status: v1. Written from `build-server/Dockerfile` and `build-server/script.js` on `main`, and from failed deployments observed in October 2026.
> Update this file whenever a decision changes, so later sessions never follow stale instructions.

## 1. Purpose

Most failed deployments seen so far are **platform limitations, not user-code bugs**. The build-server runs every repo the same way (one Node version, plain `npm install`, first folder with a `package.json`, output must be `dist` or `build`). This spec makes common frontend repos build and deploy, and makes unsupported ones fail with a clear, accurate reason.

## 2. Evidence: what the code does today

| Observed failure | Cause in the current code | Fixed in |
|------------------|---------------------------|----------|
| CRA app fails with `error:0308010C:digital envelope routines::unsupported` | Dockerfile installs **Node 22** for every build; webpack 4 (`react-scripts` < 5) needs legacy OpenSSL on Node 17+ | Step 3 |
| `ERESOLVE` on `npm install` | Install is always plain `npm install`; strict peer deps, no fallback | Step 2 |
| `EUNSUPPORTEDPROTOCOL ... workspace:*` | Install is always `npm`; npm does not support the `workspace:` protocol; no monorepo or package-manager detection | Steps 1 and 2 |
| `EBADENGINE` on a repo whose package is an Express API | `script.js` picks the **first subdirectory with a `package.json`** (alphabetical), which in a MERN repo is usually `backend/` | Step 1 |
| `Neither 'dist' nor 'build' directory exists` (Next.js) | Output directory is hard-coded to `dist`, then `build`; Next.js writes `.next` (server build) or `out` (static export) | Step 4 |
| Build "succeeds" with missing files | S3 upload errors are logged and ignored; the step still reports `exit_code=0` | Step 5 |
| Platform credentials readable by user code | `exec()` inherits the task environment (AWS keys, Kafka password); `postinstall` scripts in user repos can read them | Step 6 |
| Evidence line numbers do not match the UI | Each stdout chunk is published as one Kafka message, so one log row can hold many lines; the row index and the line index drift apart | Step 7 |
| Diagnosis says "change Build Settings" | There are no per-project build settings (output dir, commands, Node version, root directory) | Step 8 |
| `expected_output_dir` is always `dist` in `build-context.json` | Hard-coded argument in `uploadBuildContext(..., 'dist')` | Step 9 |
| No build script falls back to `npx vite build` | Fallback is wrong for non-Vite repos and hides `MISSING_BUILD_SCRIPT` | Step 2 |

## 3. Scope

### In scope
- `build-server/Dockerfile` and `build-server/script.js` (split into small, tested modules)
- `api-server`: per-project build settings, passing settings and user env vars to the task, handling new failure reasons
- Prisma migration for project settings
- ClickHouse log table: `seq` column and consumer change (read the existing consumer first)
- Contract updates in `ai-service/contracts/` for new failure reasons and build-context fields
- A local run mode so builds can be tested without ECS, Kafka or S3

### Out of scope (do NOT do here)
- **Any AWS action.** Pushing the image to the registry, registering a new ECS task definition revision, IAM changes and switching to a task role are done manually by the project owner (section 13).
- Hosting Next.js with server-side rendering (not possible on static S3 hosting; fail clearly instead)
- Private repositories, custom domains, authentication
- `ai-service` code changes (section 12 lists them as a separate task)

## 4. Prerequisites for whoever implements this

- Read the current `api-server` code: how `RunTaskCommand` overrides and environment variables are built, the `Project` and `Deployment` Prisma models, and how project environment variables are stored.
- Read the ClickHouse log table definition and the Kafka consumer that writes it.
- Docker available locally for image builds (`docker build` only; never `docker push`). If not available, mark image verification UNVERIFIED.
- A set of real test repos (section 11).

## 5. Build order

Each step ends with a demonstrable result and unit tests. Do not start a step until the previous one passes.

| Step | Work | Demo |
|------|------|------|
| 0 | Module split, local run mode, test harness, new failure reasons in contracts | `npm test` passes; a repo builds locally with logs on stdout |
| 1 | Root directory selection | MERN-style repo picks the frontend; ambiguous repo fails with a clear message |
| 2 | Package-manager-aware install, ERESOLVE retry, no vite fallback | pnpm workspace repo installs; ERESOLVE repo installs after a logged retry |
| 3 | Node version selection and legacy OpenSSL handling | CRA 4 app builds on the default Node; repo with `engines` 18 builds on Node 18 |
| 4 | Output directory detection, Next.js handling | Vite, CRA, static-export Next.js deploy; SSR Next.js fails with `UNSUPPORTED_PROJECT` |
| 5 | Honest upload | Forced S3 failure fails the step and the deployment |
| 6 | Environment sanitization and user env vars | A test `postinstall` cannot read platform secrets |
| 7 | One log row per line, with `seq` | UI row number equals diagnosis evidence line |
| 8 | Per-project build settings (API and Prisma) | Settings override detection end to end |
| 9 | Truthful build-context, final regression run | `BUILD-SERVER-FIXES-DONE.md` with the acceptance matrix |

## 6. Step 0: foundations

1. **Split `script.js` into modules** under `build-server/lib/`, each pure where possible: `detect.js` (framework, package manager, root directory), `node-version.js`, `install.js`, `output-dir.js`, `upload.js`, `env.js`, `sinks.js`. `script.js` becomes orchestration only. Behavior for working repos must not change.
2. **Sinks.** Introduce two small interfaces: a *log sink* (production: Kafka; local: stdout) and an *object sink* (production: S3; local: a folder). A `LOCAL_RUN=1` mode uses the local sinks and skips Kafka and S3 entirely. Local mode must never need credentials.
3. **Tests** with Node's built-in `node:test` (no new dependency). Fixtures are tiny directory trees under `build-server/test/fixtures/` (a `package.json`, lockfile stub, empty folders), no network.
4. **Contracts.** Add failure reasons `UNSUPPORTED_PROJECT`, `UPLOAD_FAILED`, `MISSING_BUILD_SCRIPT`, `ROOT_DIR_AMBIGUOUS`. Update the zod enum in `ai-service/contracts/`, the `api-server` failure-reason mapping and their tests. Existing reasons are unchanged.
5. Keep using the existing deployment status spellings (the API server writes `'FAILURE'`).

## 7. Step 1: root directory selection

Order of precedence:

1. `BUILD_ROOT_DIR` (project setting, Step 8). Must resolve inside the cloned repo (check with `path.resolve` and `fs.realpath`; reject `..` and symlinks that escape).
2. Repo root, if its `package.json` has a `build` script **or** a frontend framework dependency.
3. Candidate scan, maximum depth 2, ignoring `node_modules` and dot folders. A candidate is a folder with a `package.json`. Score it: +2 for a `build` script, +2 for a frontend framework dependency (`react`, `vite`, `next`, `vue`, `svelte`, `@angular/core`, `astro`, `gatsby`, `react-scripts`), -3 for server-only dependencies (`express`, `fastify`, `koa`, `@nestjs/core`) without a frontend dependency.
4. Exactly one best candidate: use it and log which one and why. Tie or none: **fail** with `ROOT_DIR_AMBIGUOUS`, listing the candidates in the log and telling the user to set a root directory. Never silently pick the first folder.

Log the decision: `[setup] root directory: frontend (reason: build script + react)`.

## 8. Step 2: install

### Package manager detection
1. `packageManager` field in `package.json` (for example `pnpm@9...`)
2. Lockfile: `pnpm-lock.yaml`, then `yarn.lock`, then `package-lock.json`
3. Default: npm

### Commands
| Manager | Command |
|---------|---------|
| npm | `npm install` (then the ERESOLVE rule below) |
| yarn | `corepack enable` then `yarn install --frozen-lockfile`; if that fails because the lockfile is out of date, retry once without `--frozen-lockfile` and log it |
| pnpm | `corepack enable` then `pnpm install --frozen-lockfile`; same single retry rule |

A project `installCommand` setting (Step 8) replaces all of this.

### Workspaces and monorepos
- Install from the **repository root** when the root `package.json` declares `workspaces` or a `pnpm-workspace.yaml` exists; then build in the selected root directory.
- If any dependency uses the `workspace:` protocol and the detected manager is npm, fail early with `UNSUPPORTED_PROJECT` and a message saying the repo needs pnpm or yarn (npm cannot install `workspace:` dependencies).

### ERESOLVE rule (npm only)
If `npm install` fails and its output contains `ERESOLVE`, retry once with `--legacy-peer-deps` and log `[setup] retrying install with --legacy-peer-deps (peer dependency conflict)`. Do not retry for any other error. The step is reported failed only if the retry also fails.

### Build command
- `buildCommand` setting, else `<pm> run build` when a `build` script exists.
- **Remove the `npx vite build` fallback.** With no `build` script and no setting, fail with `MISSING_BUILD_SCRIPT`.
- Do **not** set `CI=true`. It turns warnings into errors in Create React App.

### Captured output
`runStep` must return a bounded tail of its output (last 200 lines or 64 KB) so rules like the ERESOLVE check do not depend on Kafka.

## 9. Step 3: Node version

### Image
- Replace `ubuntu:focal` (past standard support) with a maintained base.
- Pre-install several Node majors in the image (for example 16, 18, 20, 22) using a version manager such as `n` or `fnm`. Builds must not download Node at run time. Note that Node 16 is end-of-life and is included only for legacy projects; document that.
- Enable corepack for the managers in Step 2.
- Keep the non-root user and the `kafka.pem` handling unchanged.

### Selection order
1. `NODE_VERSION` setting (Step 8)
2. `.nvmrc` or `.node-version`
3. `engines.node` in `package.json`: choose the highest installed major that satisfies the range; if none satisfies it and the range is entirely **below** the oldest installed major, choose the oldest installed and log a warning that the requested version is not available
4. Default: the current image default (Node 22), to avoid changing behavior for repos that work today

Range matching needs semver parsing. Propose the `semver` package and ask before adding it.

### Legacy OpenSSL
If the chosen Node major is 17 or higher and the project uses webpack 4 (`react-scripts` below 5, or `webpack` major 4), append `--openssl-legacy-provider` to `NODE_OPTIONS` for install and build, and log it. Never overwrite a `NODE_OPTIONS` the user set; append to it.

Log every decision: `[setup] node 18.20.x selected (source: engines.node ">=18")`.

## 10. Step 4: output directory and frameworks

After the build, find the output directory:

1. `BUILD_OUTPUT_DIR` setting, if set
2. Otherwise the first of these that contains an `index.html` at its top level: `dist`, `build`, `out`, `.output/public`, then `dist/*/browser` and `dist/*` (Angular layouts)
3. `public` only when the detected framework is Gatsby (in CRA the source `public/index.html` exists before any build and would be uploaded by mistake)
4. Prefer a directory whose `index.html` was modified after the build started, so a committed, stale `dist/` is not uploaded when the real build wrote elsewhere; if only a stale one exists, upload it but log a warning

Never treat `.next` as an output directory.

### Next.js
- After the build, if the framework is Next.js and no output directory was found, fail with `UNSUPPORTED_PROJECT` and a log line that says: this app needs a Node server (server rendering or API routes); ShipStack hosts static sites; to deploy as a static site, set `output: 'export'` in the Next.js config so the build produces `out/`.
- If `out/index.html` exists, deploy it normally.
- Do not run `next export` (removed in current Next.js versions).

### Empty or invalid output
An output directory with no `index.html` fails with `UPLOAD_EMPTY`. Static sites without an `index.html` at the top level are not supported in this version.

## 11. Step 5: honest upload

- Upload with bounded concurrency (for example 16 in flight) and up to 3 retries per file with backoff.
- Count failures. If **any** file fails after retries, end the `upload` step with exit code 1, reason `UPLOAD_FAILED`, and exit non-zero. A deployment must never be reported successful with missing files.
- Verify that `index.html` at the output root was uploaded.
- Content type via the existing `mime-types` usage, with the same fallback.
- Log totals: files uploaded, bytes, duration.
- Open issue to confirm in the API code: objects are written under `__outputs/{PROJECT_ID}/`, shared by every deployment of a project. A failed or partial upload therefore overwrites part of the live site. Report what the reverse proxy and API actually key on and propose a fix (for example per-deployment prefixes with an atomic switch) as a **separate** change; do not redesign storage in this task.

## 12. Step 6: environment and secrets

- Build the child environment from an **allowlist**: `PATH`, `HOME`, `LANG`, `TMPDIR`, plus values computed in this spec (`NODE_OPTIONS`, `COREPACK_*`) plus the user's project env vars. Do not spread `process.env`.
- The platform variables (`ECS_ACCESSKEY_ID`, `ECS_SECRET_ACCESSKEY`, `KAFKA_*`, and anything else the task is given) must not be visible to `npm`, the build command, or any script they spawn.
- The build-server process itself keeps what it needs for Kafka and S3.
- User env vars: the API server passes them to the task as one JSON value (`USER_ENV_JSON`); the build-server validates it (object of string values, size limit) and injects it into the child environment. Never log values.
- Test: a fixture repo with a `postinstall` that tries to print `process.env.KAFKA_PASSWORD` and `ECS_SECRET_ACCESSKEY`; the build log must contain neither.
- Residual risk, to document and not solve here: user code still runs as the same OS user and can read files in the container (for example `kafka.pem`) and reach the network. Recommended follow-ups: run installs and builds as a separate unprivileged user, and replace static S3 keys with an ECS **task role** (manual AWS change by the owner).

## 13. Step 7: one log row per line, with `seq`

- Split stdout and stderr into lines, buffering a partial last line between chunks. Publish **one Kafka message per line**; send a chunk's lines in one `producer.send` call.
- Add a per-process, monotonically increasing `seq` number assigned **synchronously** when a line is created (before any `await`), so ordering survives concurrent sends.
- Payload gains `seq`. The existing consumer must keep working with messages that have no `seq`.
- ClickHouse: add a `seq` column (default 0) and write it in the consumer; order log reads by `(deployment, seq, timestamp)`. Produce the migration as a documented SQL statement; do not run it against any shared database without approval.
- Result: one row equals one line, so the UI row number, the stored `seq` and the diagnosis evidence line number agree. The `ai-service` change that uses `seq` is a separate task (section 14).

## 14. Step 8: per-project build settings

Optional per-project settings, all nullable (null means auto-detect):

| Setting | Env passed to the task | Validation |
|---------|------------------------|------------|
| `rootDirectory` | `BUILD_ROOT_DIR` | relative path, no `..`, no absolute path, max 200 chars |
| `installCommand` | `BUILD_INSTALL_CMD` | string, max 500 chars |
| `buildCommand` | `BUILD_CMD` | string, max 500 chars |
| `outputDirectory` | `BUILD_OUTPUT_DIR` | relative path, no `..`, max 200 chars |
| `nodeVersion` | `NODE_VERSION` | one of the installed majors |

- Prisma migration adding the fields to `Project`; `POST /project` and an update endpoint validate with zod.
- The API server passes them (and `USER_ENV_JSON`) as container environment overrides on `RunTask`.
- The build-server re-validates everything (it does not trust its environment) and logs which settings were applied.
- Commands run in the user's own container with the user's own code, so the goal of validation is path containment and sane limits, not sandboxing.
- Frontend form fields for these settings are a separate, later task; the API must work with or without them.
- Because settings now exist, the diagnosis service may legitimately suggest them (section 15).

## 15. Step 9: truthful build-context and contracts

- `expected_output_dir` must be the real configured or detected value, or `null`; never a hard-coded `'dist'`.
- Add nullable fields to `build-context.json` and its zod schema: `root_directory`, `install_command`, `node_selected_from`, `legacy_openssl` (boolean), `output_dir_resolved`.
- Upload the context at the start (as today) and **again at the end of the build step** with the resolved output directory. A failed second upload is logged, not fatal.
- Never include env var values.

## 16. Diagnosis-service follow-ups (separate task, `ai-service`)

Not part of this change, but the observed behavior needs them:

1. **Rules must not fire on warnings.** `npm warn EBADENGINE` is a warning. Require an error-level line in the failed step, or cap confidence low when the only match is a warning. The category should reflect where the failed step actually broke.
2. **Number evidence lines by `seq`** (Step 7) so the UI and the diagnosis agree.
3. **Platform capabilities in the prompt.** State what ShipStack supports (static hosting only, available settings from Step 8, installed Node versions) so the model stops suggesting settings that do not exist. Until Step 8 ships, restrict fixes to changes inside the user's repo.
4. **Next.js guidance.** For an app that needs a server, answer `UNSUPPORTED_PROJECT` and explain static export; never suggest `.next` as an output directory or `next export`.
5. **Use the new build-context fields** (selected Node version, root directory, install command) and the new failure reasons.
6. Re-run the eval after these changes; add the observed failures as new eval cases from real captured logs.

## 17. Testing

### Unit (no network)
- Framework detection, package manager detection (including `packageManager` field vs lockfile), root directory scoring and tie handling, `workspace:` detection, Node version selection (engines ranges, `.nvmrc`, unavailable-old-version case), legacy OpenSSL decision, output directory detection (including CRA `public/index.html` trap, stale committed `dist/`, Angular layouts, Gatsby), environment allowlist, path containment (`..`, symlink escape), settings validation, line splitting with partial chunks, `seq` ordering under concurrent publishes.
- ERESOLVE retry logic with a fake runner: retries once on `ERESOLVE`, never on other errors.
- Upload: concurrency limit, retry, failure counting, `UPLOAD_FAILED`.

### Local run (no AWS)
`LOCAL_RUN=1` builds a repo with logs to stdout and output to a local folder. Used for the matrix below.

### Acceptance matrix (real repos, local run first, then one ECS run per row)
| Repo type | Expected result |
|-----------|-----------------|
| Vite + React (regression) | Deploys as before |
| CRA with `react-scripts` 4 on default Node | Deploys; log shows legacy OpenSSL decision |
| App with `engines` requiring an older installed Node | Builds on that Node |
| `ERESOLVE` repo (React 18 with an old peer range) | Deploys after a logged `--legacy-peer-deps` retry |
| pnpm monorepo with `workspace:` deps | Deploys with pnpm from the repo root |
| MERN repo (`backend/` + `frontend/`) | Frontend selected; deploys |
| Repo with two plausible frontends | Fails with `ROOT_DIR_AMBIGUOUS` and a clear message |
| Next.js with `output: 'export'` | Deploys from `out/` |
| Next.js with server rendering | Fails with `UNSUPPORTED_PROJECT` and the static export explanation |
| Repo with a committed stale `dist/` and a real build into `build/` | Uploads `build/` |
| Forced S3 failure | Fails with `UPLOAD_FAILED`; deployment marked failed |
| Repo with a `postinstall` printing platform secrets | Secrets absent from the log |
| Repo with no build script | Fails with `MISSING_BUILD_SCRIPT` |

## 18. Deliverables checklist

- [ ] Module split, sinks, `LOCAL_RUN`, test harness (Step 0)
- [ ] New failure reasons in contracts, mapper and tests
- [ ] Root directory selection (Step 1)
- [ ] Package-manager-aware install, ERESOLVE retry, vite fallback removed (Step 2)
- [ ] New Dockerfile with several Node versions and corepack; Node selection and legacy OpenSSL (Step 3)
- [ ] Output directory detection and Next.js handling (Step 4)
- [ ] Honest upload (Step 5)
- [ ] Environment allowlist and `USER_ENV_JSON` (Step 6)
- [ ] One row per line with `seq`, ClickHouse change documented (Step 7)
- [ ] Project settings: migration, validation, API, task overrides (Step 8)
- [ ] Truthful build-context, second upload (Step 9)
- [ ] Acceptance matrix results with evidence
- [ ] `docs/build-server/BUILD-SERVER-FIXES-DONE.md`: what changed, how to run locally, matrix results, known gaps, the exact manual steps for the owner (section 19)

## 19. Manual steps for the owner (not done by code or agents)

1. Review the new Dockerfile, build the image locally, test with `LOCAL_RUN=1`.
2. Push the image to the registry and register a new ECS task definition revision pointing at it (AWS console).
3. Update `ECS_TASK_DEFINITION` (or the revision the API server uses) in the API server environment.
4. Apply the ClickHouse and Prisma migrations to your databases.
5. Optional hardening: create an ECS task role with S3 write access to the bucket and remove static S3 keys from the task environment.
6. After rollout, stop any test tasks left running in the ECS console.

## 20. Definition of done

- Every row of the acceptance matrix passes with evidence (log output), or is marked UNVERIFIED with the reason
- Unit tests pass; existing tests pass; the previously working Vite and CRA flows are unchanged
- No platform secret is visible to user build scripts (tested)
- A failed upload never produces a successful deployment (tested)
- Evidence line numbers equal UI row numbers on a real multi-line log
- `build-context.json` reports the real output directory, Node version and root directory
- No AWS resource or `docker push` was touched by the implementation

## 21. Working agreement for contributors (human or AI)

- Read the existing code first; match patterns and existing status spellings.
- Never create, modify or delete AWS resources; never `docker push`.
- No new dependencies without asking (propose `semver` and justify it).
- One step at a time; show real test output before moving on.
- Behavior for repos that build today must not change unless this spec says so.
- List assumptions explicitly; mark anything unverified as UNVERIFIED.
- Do not rename or refactor unrelated code.

## 22. Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Default Node | Stay on the current default (22); select others only from signals | No regressions for repos that work today |
| Legacy webpack | Auto `--openssl-legacy-provider`, logged | Fixes the most common CRA failure without a Node downgrade |
| Peer conflicts | One logged retry with `--legacy-peer-deps` | Most ERESOLVE repos build fine with it; the retry is visible |
| Root directory | Score candidates; fail when ambiguous | Silent guessing built the wrong package |
| Output directory | Require `index.html`, prefer fresh files | Avoids uploading source or stale folders |
| Next.js | Static export only; clear `UNSUPPORTED_PROJECT` otherwise | S3 hosting cannot run a server |
| Upload errors | Fail the step | A partial site must never look successful |
| Child environment | Allowlist, not blocklist | New platform secrets are safe by default |
| Logs | One row per line plus `seq` | Makes line numbers consistent across UI and diagnosis |
| Settings | Optional per-project overrides | Detection can be wrong; users need an escape hatch |
| Image rollout | Manual by owner | Matches how AWS resources are managed today |

## 23. Open items

- How does the API server pass user env vars to the task today, and where are they stored?
- What do the reverse proxy and API key on: project id or deployment id (section 11)?
- Which Node majors should stay installed, and until when?
- Should installs and builds run as a separate unprivileged user or in a second container?

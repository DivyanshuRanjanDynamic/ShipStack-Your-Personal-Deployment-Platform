# Phase 0: Foundations for AI Deployment Diagnosis + RAG

> Location in repo: `docs/ai-diagnosis/PHASE0.md`
> Status: Draft v1. Update this file whenever a decision changes, so later sessions never follow stale instructions.

## 1. Purpose

ShipStack builds GitHub repos on ECS, streams logs through Kafka into ClickHouse, and serves output from S3. When a build fails, users currently see only raw logs. The AI diagnosis feature will turn a failed deployment into a structured, evidence-backed root cause and fix.

Phase 0 builds only the foundations that every later phase depends on:

1. A **failure taxonomy** (the closed set of answers).
2. **Data contracts** between services.
3. **Build-server signals** (step markers and build context) so failures are diagnosable.
4. An **evaluation set** so accuracy can be measured, not guessed.

## 2. Scope

### In scope
- `taxonomy.json` and its schema
- zod schemas and TS types for all contracts
- Prisma `Diagnosis` model and migration
- Minimal, backward-compatible build-server changes
- Eval fixtures, generator script, validator script, dev/test split

### Out of scope (do NOT build in Phase 0)
- `ai-service`, Kafka consumer for diagnosis, any LLM calls
- Retrieval, embeddings, pgvector, knowledge base
- Frontend diagnosis card
- Auto-fix / redeploy

## 3. Existing architecture (for context)

```
React ──▶ API Server (Express, Prisma+Postgres) ──▶ ECS task (build-server)
build-server ──logs──▶ Kafka ──▶ Kafka consumer ──▶ ClickHouse
build-server ──static output──▶ S3  (__outputs/{project_id})
s3-reverse-proxy ──gRPC──▶ API Server (subdomain → S3 path)
```

Failure signals today come only from logs. Phase 0 adds step markers, exit/failure reasons, and a build-context file.

## 4. Failure taxonomy

Twelve categories plus a fallback. Every diagnosis must resolve to exactly one primary category.

| # | id | Typical signature | Usual root cause → fix | requires_step |
|---|----|-------------------|------------------------|---------------|
| 1 | `NODE_VERSION_MISMATCH` | `Unsupported engine`, `requires Node >=18` | Repo needs a different Node version → set version / `engines` | install, build |
| 2 | `DEPENDENCY_CONFLICT` | `ERESOLVE`, peer dependency conflict | Incompatible peer deps → pin versions or `--legacy-peer-deps` | install |
| 3 | `MODULE_NOT_FOUND` | `Cannot find module`, `Can't resolve './Header'` | Missing dep, or case-sensitive import (works on Windows/macOS, fails on Linux) | build |
| 4 | `MISSING_BUILD_SCRIPT` | `Missing script: "build"` | No build script → add one or change build command | build |
| 5 | `WRONG_OUTPUT_DIR` | Build succeeds, upload finds nothing | Output is `out/` or `public/`, not `dist/` or `build/` | upload |
| 6 | `OUT_OF_MEMORY` | `heap out of memory`, exit code 137 | Build too heavy for task memory → raise memory / `NODE_OPTIONS` | install, build |
| 7 | `BUILD_TIMEOUT` | No error line, task killed | Install/build exceeds limit → cache, trim, raise limit | any |
| 8 | `MISSING_ENV_VAR` | Undefined env, empty `VITE_*`, missing API URL | Required env var not provided | build |
| 9 | `CODE_ERROR` | TS errors, ESLint, syntax errors, `Treating warnings as errors because CI=true` | Real bug, or CRA CI warning rule | build |
| 10 | `LOCKFILE_MISMATCH` | `npm ci` out of sync, wrong package manager | Lockfile differs from package.json, or yarn/pnpm needed | install |
| 11 | `REPO_ACCESS` | `Repository not found`, auth failed | Private or mistyped repo URL | clone |
| 12 | `UNSUPPORTED_PROJECT` | No package.json, Next.js SSR app, backend repo | Not a static frontend → explain what is supported | any |
| – | `UNKNOWN` | – | The model must be allowed to say it is not sure | any |

Categories 5, 7 and 11 often have no useful error line. They depend on the step markers and failure reasons defined in section 5.

### Deliverable
`ai-service/taxonomy/taxonomy.json` with, for each category: `id`, `description`, `log_signatures[]`, `typical_fix`, `requires_step[]`. Plus a zod schema that validates the file, and a test that fails if an id is duplicated or missing.

## 5. Build-server changes

Keep changes minimal and **backward compatible** with the existing Kafka consumer and ClickHouse schema.

### 5.1 Step markers
Every log message published to Kafka gains a `step` field: `clone | install | build | upload`.
Also emit `step_start` / `step_end` events (with exit code per step).
Existing consumer must keep working if the field is absent (old messages) or present (new messages).

### 5.2 Build context file
At build start, write `build-context.json` to S3 at:

```
__meta/{deployment_id}/build-context.json
```

Contents:

```json
{
  "deployment_id": "dep_123",
  "git_url": "https://github.com/...",
  "framework": "vite | cra | next | unknown",
  "package_manager": "npm | yarn | pnpm",
  "node_version": "20.11.0",
  "engines": { "node": ">=18" },
  "scripts": { "build": "vite build" },
  "build_command": "npm run build",
  "expected_output_dir": "dist",
  "has_lockfile": true,
  "captured_at": "2026-10-09T15:30:00Z"
}
```

Rules:
- Never include env var values or secrets. Env var **names** only, if included at all.
- Missing fields are `null`, never omitted.

### 5.3 Failure reason
When a task ends unsuccessfully, record one of:
`TASK_OOM | TIMEOUT | NONZERO_EXIT | UPLOAD_EMPTY | CLONE_FAILED`
together with exit code and failed step. (Detecting ECS task-state changes via EventBridge is Phase 1; Phase 0 only defines the field.)

## 6. Data contracts

All contracts live in `ai-service/contracts/` (or a shared package) as zod schemas with inferred TS types. Every external payload is validated.

### 6.1 Kafka message: `diagnosis-requests`

```json
{
  "deployment_id": "dep_123",
  "project_id": "proj_456",
  "user_id": "usr_789",
  "git_url": "https://github.com/...",
  "failed_step": "build",
  "exit_code": 137,
  "failure_reason": "TASK_OOM",
  "context_s3_key": "__meta/dep_123/build-context.json",
  "failed_at": "2026-10-09T15:30:00Z"
}
```

### 6.2 LLM output schema (validate; retry once on invalid output)

```json
{
  "category": "<taxonomy id or UNKNOWN>",
  "confidence": 0.0,
  "root_cause": "string",
  "evidence": [{ "line": 142, "text": "string" }],
  "fix_steps": [{ "step": "string", "type": "config | code | env | none" }],
  "sources": ["kb_chunk_id"],
  "needs_human": false
}
```

Constraints: `category` must be in the taxonomy; `confidence` in [0,1]; `evidence` must reference real log line numbers (checked in evaluation).

### 6.3 Prisma model

```prisma
model Diagnosis {
  id            String   @id @default(cuid())
  deploymentId  String   @unique
  status        String   // PENDING | DONE | FAILED
  category      String?
  confidence    Float?
  rootCause     String?
  fixJson       Json?
  signatureHash String?  @db.VarChar(64)
  source        String?  // RULES | LLM | CACHE
  model         String?
  tokensIn      Int?
  tokensOut     Int?
  latencyMs     Int?
  feedback      Int?     // -1, 0, 1
  createdAt     DateTime @default(now())

  @@index([signatureHash])
}
```

Migration must apply cleanly on a fresh database and on the existing one.

## 7. Evaluation set

### 7.1 Size and composition
- 4 cases per category x 12 categories = 48
- Plus about 6 hard cases: two simultaneous errors, noisy logs with an unrelated warning, an ambiguous failure
- Total about 54

### 7.2 How cases are created
1. Create base repos: Vite+React, CRA, and one using yarn or pnpm (all working builds).
2. Express each failure as a **mutation patch** (for example: change `engines` to Node 22, change an import's casing, delete the build script).
3. Store patches under `eval/mutations/<CATEGORY>/NN.patch`.
4. A script applies each patch on a branch of an `eval-fixtures` repo.
5. Run each broken repo through ShipStack and **capture the real logs**. Real output is required; model-invented logs look plausible but differ from real npm/Vite output and make the benchmark measure the wrong thing.
6. Vary every category across framework, package manager, and clean vs noisy logs.

### 7.3 Fixture layout

```
eval/
  cases/
    NODE_VERSION_MISMATCH-02/
      logs.txt              # real captured logs, with step markers
      build-context.json    # matches section 5.2
      expected.json         # ground truth
  mutations/<CATEGORY>/NN.patch
  split.json                # dev / test assignment
  scripts/
    generate.ts
    validate.ts
```

### 7.4 Ground-truth format (`expected.json`)

```json
{
  "id": "NODE_VERSION_MISMATCH-02",
  "category": "NODE_VERSION_MISMATCH",
  "secondary_categories": [],
  "root_cause_must_mention": ["node", "engine", ">=20"],
  "fix_must_mention": ["node version", "20"],
  "difficulty": "easy | medium | hard",
  "framework": "vite",
  "package_manager": "npm"
}
```

### 7.5 Split
About 60% dev (used for tuning prompts and rules), about 40% locked test (run only for final numbers). Record the assignment in `split.json` and do not change it after seeing results. Tuning on the test set inflates reported accuracy.

### 7.6 Metrics (defined now, computed in later phases)
- Category accuracy (primary), also by difficulty
- Root-cause correctness, scored 0/1/2 by keyword rubric, with a hand check on about 20 samples
- Evidence validity (do cited log lines exist?)
- JSON validity rate
- p50 / p95 latency and cost per diagnosis

Baselines to compare later: rules only, LLM only, LLM + RAG.

## 8. Deliverables checklist

- [ ] `taxonomy.json` + zod schema + tests
- [ ] zod schemas and TS types: Kafka message, LLM output, build-context
- [ ] Prisma `Diagnosis` model + migration
- [ ] build-server: step markers + `build-context.json` upload (backward compatible)
- [ ] `eval/` base repos, mutation patches, generator, validator, `split.json`
- [ ] About 54 cases generated from real captured logs
- [ ] `docs/ai-diagnosis/PHASE0-DONE.md` describing what was built and how to run it

## 9. Definition of done

- Schemas compile and validate sample payloads (positive and negative tests included)
- Prisma migration applies cleanly
- build-server still builds, and the existing log flow into ClickHouse is unchanged
- Validator passes on every generated eval case
- No secrets in any fixture
- All commands needed to reproduce the above are documented

## 10. Working agreement for contributors (human or AI)

- Read the existing code before changing it; follow the patterns in each service.
- No placeholders or TODO stubs; if blocked, stop and report.
- No new dependencies without discussion.
- One deliverable at a time; show test output before moving on.
- List assumptions explicitly rather than presenting them as verified.

## 11. Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Taxonomy size | 12 + UNKNOWN | Covers common static-frontend failures; UNKNOWN keeps the model honest |
| Eval before build | Required | Makes RAG's value measurable |
| Fixtures from real logs | Required | Avoids a benchmark that does not match production |
| Dev/test split | 60/40, frozen | Prevents tuning on the test set |
| Vector store (later) | pgvector | Already running Postgres; scale does not justify a new system |

## 12. Open questions

- Which Node versions should the build-server support, and how is one selected per project?
- Is `build-context.json` captured before or after dependency install (affects detected framework accuracy)?
- Where should shared contracts live: inside `ai-service` or a separate package?

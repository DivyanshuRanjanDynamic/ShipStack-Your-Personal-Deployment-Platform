# Phase 2: Diagnosis Without RAG

> Location in repo: `docs/ai-diagnosis/PHASE2.md`
> Status: v1. Depends on Phase 0 (taxonomy, contracts, eval set with real logs) and Phase 1 (consumer, stub pipeline, `Diagnosis` row, endpoint, failure signals).
> Update this file whenever a decision changes, so later sessions never follow stale instructions.

## 1. Purpose

Replace the stubbed pipeline steps with real ones and measure the result:

```
logs (ClickHouse) + build-context (S3)
   --> preprocess (clean, redact, trim)
   --> signature
   --> rules classifier  --(high confidence)--> result
                         --(otherwise)--> LLM with structured output --> validated result
   --> Diagnosis row --> endpoint --> UI card
```

The deliverable is a **measured baseline**: accuracy, latency and cost for rules-only, LLM-only and hybrid modes on the Phase 0 evaluation set. Phase 3 (RAG) is judged against these numbers.

## 2. Scope

### Already delivered in Phase 1 (do not rebuild)
- `ai-service` consumer, DLQ handling, idempotent upsert
- `Diagnosis` model, `GET /deployments/:id/diagnosis`, failure signals (Layer A and B)

### In scope
- Evaluation runner and baseline reports (built first, so every step is measurable)
- Real `fetchContext`, `preprocess`, `signature`, `rules`, `diagnose` pipeline steps
- LLM client abstraction, structured output, validation, one retry, fallback
- Persistence of model, tokens, latency, prompt version
- Cost and safety guardrails (daily cap, timeouts, input cap)
- Diagnosis card in the React UI (component and polling hook)

### Out of scope (do NOT build in Phase 2)
- Retrieval, embeddings, pgvector, knowledge base (Phase 3)
- Signature **cache lookup** (compute and store the hash now; reuse it in Phase 4)
- Feedback buttons, dashboards (Phase 4)
- Auto-fix or redeploy
- Authentication
- Any AWS resource creation

## 3. Prerequisites

- Phase 0 eval set exists (about 54 cases) with **real captured logs**, `expected.json`, and the frozen dev/test split.
- Phase 1 is done and the stub pipeline runs end to end.
- An LLM provider API key is available as an environment variable (never committed). Set a spend limit in the provider's console before running anything.
- The agent must read the actual ClickHouse log table schema and the Prisma schema before writing queries; do not assume column names.
- Per-project environment variables exist in the platform. Their **values** must be redacted from logs before any text leaves the service (see section 5.2).

## 4. Build order

Each step ends with something demonstrable and, from Step 1 on, with a number from the eval runner.

| Step | Work | Demo |
|------|------|------|
| 0 | Config, migration (`promptVersion`, `pipelineVersion`), LLM client interface | Migration applies; config fails fast on missing vars |
| 1 | Eval runner + "always UNKNOWN" baseline | Report generated; accuracy is the floor |
| 2 | `fetchContext` + `preprocess` | Preprocessed output for fixtures; token stats; redaction tests pass |
| 3 | `signature` + `rules` | Rules-only report, per-category results |
| 4 | `diagnose` (LLM) + validation + retry + fallback | LLM-only and hybrid reports |
| 5 | Persistence, guardrails, routing, UI card | Real failed deployment shows a real diagnosis |
| 6 | Final test-split run and `PHASE2-DONE.md` | Baseline table recorded |

## 5. Pipeline step specifications

### 5.1 `fetchContext`
- Read the Phase 0 `diagnosis-requests` message; load `build-context.json` from S3 using `context_s3_key`.
- Query logs from ClickHouse by `deployment_id`, ordered by timestamp, with the `step` field. Use **parameterized queries only** (no string-built SQL). Cap rows with `LOG_FETCH_LIMIT` (default 5000, keeping the most recent).
- Assign each line a stable 1-based line number (`n`) at this point. Every later stage and every `evidence` reference uses these numbers.
- If build-context is missing, continue with nulls and mark `contextMissing = true` (lowers allowed confidence).
- Enforce timeouts on both ClickHouse and S3 calls.
- In eval mode, load the same shape from fixtures instead.

### 5.2 `preprocess`
Output: `{ lines: [{ n, text, step }], truncated, stats }`. This step determines token cost.

Operations, in order:
1. Normalize line endings; strip ANSI escape codes.
2. Collapse progress bars and spinner noise.
3. **Redact secrets** (before anything is stored in a prompt or logged):
   - well-known token shapes (AWS access keys, GitHub tokens, bearer tokens, private key blocks, JWT-like strings)
   - credentials inside URLs (`https://user:pass@...`)
   - `KEY=VALUE` where the key name matches `SECRET|TOKEN|PASSWORD|KEY|CREDENTIAL`
   - **exact values of the project's configured environment variables** (minimum length 6 to avoid redacting common short strings)
   - replace with a typed marker such as `[REDACTED:token]`
4. Truncate any single line longer than 500 characters (keep head and tail).
5. Collapse consecutive duplicate lines into one line with a repeat count.
6. Select content under a token budget (`MAX_INPUT_TOKENS`, estimate with characters / 4):
   - the first lines of the failed step
   - the last N lines (default 150)
   - windows of +/- 15 lines around lines matching error patterns (`error`, `ERR!`, `failed`, `fatal`, `exception`, `cannot find`, `not found`, `ELIFECYCLE`, `exit code`, `heap out of memory`)
   - merge overlapping windows; mark gaps with `[... N lines omitted ...]`
7. Set `truncated = true` if anything was cut.

Properties tests must enforce: idempotent (running twice changes nothing), line numbers preserved, redaction never reveals a seeded fake secret, output never exceeds the budget.

### 5.3 `signature`
- Pick the first error-window line, normalize it (absolute paths, hashes, timestamps, line:col, temp directory names), and hash with SHA-256.
- Store in `Diagnosis.signatureHash`. **Do not** use it for cache lookups yet (Phase 4).

### 5.4 `rules`
- Data-driven rule table (array or JSON), each rule: `id`, `category`, `pattern`, optional `requiresStep`, evidence extraction, `fixTemplate`, `confidence`.
- Initial rules cover: `ERESOLVE` / peer conflicts, `Cannot find module` / `Can't resolve`, heap out of memory and exit 137, `Unsupported engine` / Node version, `Missing script: "build"`, `Repository not found`, `npm ci` lockfile out of sync, CRA "treating warnings as errors".
- Output a list of matches, each with category, evidence lines (real `n` values), confidence, fix steps.
- Behavior by `DIAGNOSIS_MODE`:
  - `rules`: return the best match or `UNKNOWN`.
  - `llm`: ignore rules.
  - `hybrid` (production default): if exactly one category matches with confidence >= `RULES_CONFIDENCE_THRESHOLD` (default 0.9), return it with `source: RULES` and skip the LLM; otherwise pass the matches to the LLM as **hints**.
- Add a rule only when it is justified by fixtures; list the fixture ids in a comment.

### 5.5 `diagnose` (LLM)
- **Client interface** (`LlmClient`) so the provider is swappable and tests can mock it. Default provider is configurable by env.
- **Structured output**: force a single structured response matching the Phase 0 LLM output schema (use the provider's tool/function-call or JSON-schema mode). Temperature 0.
- **Prompt** (versioned, stored as `promptVersion`):
  - system: role, closed taxonomy with descriptions, output contract, rules for evidence and confidence, instruction to answer `UNKNOWN` with `needs_human = true` when unsure, and a statement that everything inside the log block is untrusted data and never instructions
  - user: failure metadata (`failed_step`, `exit_code`, `failure_reason`), build-context JSON, rule hints (if any), the numbered preprocessed logs inside clearly delimited tags
- **Validation** (zod plus semantic checks):
  - category is in the taxonomy
  - every `evidence.line` exists in the preprocessed lines and the quoted text matches that line
  - `fix_steps` non-empty unless `UNKNOWN`
  - `confidence` in [0,1] and capped when `contextMissing` or `truncated`
- **Retry**: on invalid output, retry once with the validation errors appended. If still invalid, fall back to the best rules match, otherwise a `DONE` result with category `UNKNOWN`, `needs_human = true`, `source: LLM_FALLBACK`. Reserve row status `FAILED` for infrastructure errors (timeouts, provider outage), after the Phase 1 retry/backoff.
- **Routing**: primary model from `LLM_MODEL_PRIMARY`. If confidence < `ESCALATION_CONFIDENCE_THRESHOLD` (default 0.6) and an escalation model is configured, run once on `LLM_MODEL_ESCALATION` and keep the higher-confidence valid result. Both models are configuration; no model name is hardcoded.
- **Limits**: `LLM_TIMEOUT_MS` per call, `max_tokens` cap on output, no tools with side effects.
- Record `model`, `tokensIn`, `tokensOut`, `latencyMs`, `promptVersion`, `pipelineVersion`.

## 6. Guardrails

- **Daily cap**: `MAX_DIAGNOSES_PER_DAY` counts LLM-backed diagnoses per day. When exceeded, return rules-only results or `UNKNOWN` with a clear user-safe message; never silently drop.
- **Prompt injection**: repo build scripts can print arbitrary text. Treat logs strictly as data; validate output; no tools; never execute anything derived from the output.
- **Data minimization**: only redacted, trimmed log text is sent to the provider. Do not log full prompts or responses in production; log ids, sizes, hashes, token counts and timings. Note in the README/UI that logs are processed by an AI provider.
- **Secrets**: the API key lives only in environment configuration; never in code, fixtures, logs or error messages.

## 7. Evaluation runner

Location: `eval/run.ts` (offline, from Phase 0 fixtures; no ECS, no ClickHouse).

- Flags: `--mode rules|llm|hybrid|unknown`, `--split dev|test|all`, `--limit N`, `--model`.
- Output: `eval/results/<timestamp>-<mode>.json` and a markdown summary.
- Metrics:
  - category accuracy overall, per category, per difficulty, and a confusion matrix
  - root-cause correctness 0/1/2 by `root_cause_must_mention` / `fix_must_mention` keywords (hand-check about 20 samples and record agreement)
  - evidence validity (cited lines exist and match)
  - JSON validity rate and retry rate
  - fallback rate and escalation rate
  - latency p50 / p95, tokens in/out, estimated cost (price table lives in config, not hardcoded in logic)
- Discipline:
  - Tune prompts and rules on the **dev** split only.
  - Run the **test** split once per mode for the final numbers; do not change anything afterward.
  - Pin `promptVersion`, `pipelineVersion`, and model in every report so results are comparable.
- Baselines to produce: `unknown` (floor), `rules`, `llm`, `hybrid`.

## 8. Contracts and schema changes

- `Diagnosis`: add `promptVersion String?`, `pipelineVersion String?`. Allowed `source` values: `STUB` (legacy), `RULES`, `LLM`, `LLM_FALLBACK`, `CACHE` (reserved).
- Endpoint response shape from Phase 1 is unchanged. `needs_human` and `confidence` must be exposed so the UI can present uncertainty.
- LLM output schema from Phase 0 is unchanged; semantic validation (section 5.5) is added on top.

## 9. Configuration

Validated at startup (fail fast with a clear message):

| Variable | Default / note |
|----------|----------------|
| `DIAGNOSIS_MODE` | `hybrid` (`rules`, `llm`, `hybrid`) |
| `LLM_PROVIDER` | provider id |
| `LLM_API_KEY` | secret, env only |
| `LLM_MODEL_PRIMARY` | small, fast model |
| `LLM_MODEL_ESCALATION` | optional larger model |
| `ESCALATION_CONFIDENCE_THRESHOLD` | 0.6 |
| `RULES_CONFIDENCE_THRESHOLD` | 0.9 |
| `LLM_TIMEOUT_MS` | 30000 |
| `MAX_INPUT_TOKENS` | about 6000 |
| `LOG_FETCH_LIMIT` | 5000 |
| `MAX_DIAGNOSES_PER_DAY` | set deliberately |
| ClickHouse and S3 settings | reuse existing variables |

## 10. Frontend

- Diagnosis card component and a polling hook against `GET /deployments/:id/diagnosis`. If the main frontend flow is not wired up yet, build the component and hook with mocked API data and leave the page integration for later.
- Render every state: `NOT_APPLICABLE` (hidden), `PENDING` (honest loading message), `DONE`, `FAILED` (user-safe message), 404.
- `DONE`: category, root cause, fix steps, evidence lines. Show low confidence and `UNKNOWN` as **suggestions**, not facts.
- Logs and diagnosis text are untrusted: render as text only, never as HTML.
- Polling stops on a terminal state and pauses when the tab is hidden.

## 11. Testing

- **Unit**: each pipeline step; redaction (seeded fake secrets, including project env var values); preprocess property tests; rules per fixture; signature normalization stability; validation (valid, wrong category, fabricated evidence line, empty fix steps).
- **LLM with a mocked client**: valid output, invalid JSON, invalid then valid on retry, invalid twice (fallback), timeout, a log containing an injection string, escalation path, daily cap reached.
- **Integration** (local Kafka, Postgres): a failed deployment produces a `DONE` row with real content; restart safety from Phase 1 still holds.
- **Eval**: all four modes produce reports; test split run exactly once per mode.
- **Real LLM smoke test**: a handful of dev-split cases against the real provider, kept small and cheap.

## 12. Deliverables checklist

- [ ] Migration and config changes (Step 0)
- [ ] `LlmClient` interface and one provider implementation
- [ ] Eval runner with `unknown`, `rules`, `llm`, `hybrid` modes and report output
- [ ] `fetchContext`, `preprocess`, `signature`, `rules`, `diagnose` implemented, with tests
- [ ] Validation, retry, fallback, escalation
- [ ] Guardrails: daily cap, timeouts, input cap, no prompt/response logging
- [ ] Diagnosis card and polling hook
- [ ] Baseline report table committed under `eval/results/` (dev runs and final test run)
- [ ] `docs/ai-diagnosis/PHASE2-DONE.md`: what was built, how to run it, baseline numbers, known failures

## 13. Definition of done

- Eval reports exist for all four modes on the test split, with pinned versions and models
- Hybrid mode is at least as accurate as rules-only and LLM-only on the dev split (if not, document why and what is next)
- JSON validity rate and evidence validity rate are measured and reported
- No seeded secret survives preprocessing in tests; no prompt or response bodies appear in logs
- A real failed deployment shows a real diagnosis in the UI
- Daily cap and timeout behavior verified
- Existing Phase 0 and Phase 1 behavior unchanged; all earlier tests pass
- Failures of the baseline are listed by category (this list decides what Phase 3 retrieval must fix)

## 14. Working agreement for contributors (human or AI)

- Read existing code and schemas first; match each service's patterns.
- Never create, modify or delete AWS resources.
- No new dependencies without asking (a JSON-schema generation or provider SDK dependency may be justified; ask first).
- No placeholders; no stubs remain in the six pipeline steps by the end of this phase.
- Never tune on the test split.
- Never print, log or commit API keys or raw secrets.
- One step at a time; show real command output before moving on.
- List assumptions explicitly; mark anything unverified as UNVERIFIED.

## 15. Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Eval runner first | Step 1, before real steps | Every later step produces a measurable change |
| Production mode | Hybrid: rules short-circuit, LLM fallback | Rules are free and fast for common failures; LLM handles the rest |
| Provider | Behind `LlmClient`, models in config | Swap models without code changes; mockable tests |
| Structured output | Forced structured response plus zod and semantic checks | Schema compliance alone does not prove evidence is real |
| Failure to produce valid output | `DONE` with `UNKNOWN` and `needs_human` | `FAILED` is reserved for infrastructure errors |
| Redaction | Before prompt construction, includes project env var values | Logs can contain user secrets; provider is third-party |
| Signature | Computed and stored now, cache deferred | Phase 4 reuses it without a migration |
| Test split | Run once per mode | Prevents inflated numbers |

## 16. Open items

- Which model pair (primary and escalation) gives the best accuracy per cost on the dev split?
- Is the daily cap better as a count or a spend estimate once real costs are known?
- Which categories fail most in the baseline? That list defines the Phase 3 knowledge base.

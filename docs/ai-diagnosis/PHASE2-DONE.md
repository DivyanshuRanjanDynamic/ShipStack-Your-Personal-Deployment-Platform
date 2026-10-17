# Phase 2: DONE — AI Deployment Diagnosis Pipeline & Evaluation Harness

This document summarizes the complete implementation of Phase 2 for ShipStack's AI deployment diagnosis system. It records the architecture built, operational commands, and the final baseline evaluation results across all 4 modes on both `dev` and `test` splits.

---

## 1. What Was Built

### Step 0: Database Migration, Contracts & LLM Client Interface
- **Prisma Schema & Migrations**: Added `signatureHash`, `source`, `model`, `tokensIn`, `tokensOut`, `latencyMs`, `promptVersion`, `pipelineVersion`, `needsHuman`, and `feedback` to the PostgreSQL `Diagnosis` model. Created additive SQL migration `api-server/prisma/migrations/20261016000000_add_diagnosis_phase2_fields/migration.sql`.
- **gRPC Contract (`proto/diagnosis.proto`)**: Extended `MarkDoneRequest` to receive all Phase 2 metadata fields, and updated `api-server/index.js` to persist them.
- **Provider Interface**: Implemented `LlmClient` interface in `ai-service/src/llm/client.ts` and `GroqClient` in `ai-service/src/llm/groq-client.ts` with structured output support, configurable timeout, token accounting, and zero sensitive-data logging.

### Step 1: Evaluation Runner & Metrics Engine
- **Harness (`eval/run.ts`)**: Supports `--mode <unknown|rules|llm|hybrid>`, `--split <dev|test|all>`, `--limit N`, and `--model`. Loads fixtures from `eval/cases/` and runs the isolated pipeline per case.
- **Metrics Computation (`eval/metrics.ts`)**: Evaluates category accuracy, difficulty accuracy, confusion matrix, semantic root-cause & fix keyword matching (0/1/2 score), evidence citation validity against actual log lines, JSON validity, retries, fallbacks, latency distributions (p50/p95/mean), token usage, and cost estimation.
- **Reporting (`eval/reporter.ts`)**: Automatically writes markdown and structured JSON reports to `eval/results/<timestamp>-<mode>.md`.
- **Floor Baseline (`unknown` mode)**: All cases return `UNKNOWN` with confidence 0 to establish the baseline floor (0% accuracy).

### Step 2: Context Retrieval & Sanitization (`fetchContext` + `preprocess`)
- **Context Fetching (`ai-service/src/pipeline/fetchContext.ts`)**: Loads ClickHouse logs and S3 `build-context.json` (or evaluation fixtures). Assigns stable, 1-based log line numbers (`n`) that persist through all downstream stages. Enforces `LOG_FETCH_LIMIT` and handles missing context gracefully.
- **Redaction Engine (`ai-service/src/pipeline/redact.ts`)**: Deterministically redacts AWS access keys (`AKIA...`), GitHub personal tokens (`ghp_...`), bearer tokens, PEM private key blocks, JWTs, credentials in URLs, `KEY=VALUE` credential assignments, and project environment variable values. Tested with property-based unit tests.
- **Preprocessing (`ai-service/src/pipeline/preprocess.ts`)**: Strips ANSI escape codes, normalizes CRLF endings, collapses consecutive duplicate lines and progress bars, truncates lines exceeding 500 characters, and applies token-budget windowing around error markers.

### Step 3: Normalization, Signature & Deterministic Rule Engine
- **Signature (`ai-service/src/pipeline/signature.ts`)**: Extracts the primary error window, strips non-deterministic tokens (UUIDs, ISO timestamps, absolute paths, line:column offsets, hex addresses), and produces a stable SHA-256 hash.
- **Rule Engine (`ai-service/src/pipeline/rules.ts` & `rules-table.ts`)**: Fast, data-driven heuristic classifier matching deterministic failure signatures (e.g. npm `ERESOLVE` peer dependency conflicts, module resolution failures). Extracts exact 1-based log line evidence and templated remediation steps. Short-circuits high-confidence matches (≥ 0.9) in hybrid mode.

### Step 4: Structured LLM Diagnosis & Semantic Validation
- **Prompt Architecture (`ai-service/src/pipeline/prompt.ts`)**: Semver-tracked (`2.0.0`) system and user prompt builder. Enforces closed 12-category taxonomy, strict citation rules, and delimited log boundaries to resist prompt injection.
- **Semantic Validator (`ai-service/src/pipeline/validate-output.ts`)**: Zod-based structural validation combined with log-grounded semantic checks: ensures cited evidence lines exist in preprocessed logs and cited text exists verbatim on those lines. Caps allowed confidence when build context is missing.
- **Retry & Fallback Flow (`ai-service/src/pipeline/diagnose.ts`)**:
  - Validates initial response; on validation failure, retries once with feedback describing the exact validation errors.
  - If retry fails, falls back to the best heuristic rule match, or returns `UNKNOWN` with `source: LLM_FALLBACK` and `needs_human: true`.
  - Supports model escalation when primary model confidence falls below `ESCALATION_CONFIDENCE_THRESHOLD`.

### Step 5: Persistence, Guardrails & Frontend UI
- **Consumer Pipeline (`ai-service/src/consumer.ts`)**: Passes all Phase 2 fields to `store.markDone`.
- **Daily Cap Guardrail**: Enforces `MAX_DIAGNOSES_PER_DAY` (default: 500). When exceeded, bypasses the LLM and writes a safe `UNKNOWN` diagnosis advising manual review.
- **API Server Endpoint (`api-server/routes/diagnosis.js`)**: Serves `GET /deployments/:id/diagnosis` exposing `confidence`, `source`, `needs_human`, `fix_steps`, and `evidence`.
- **Frontend Integration (`frontend/src/pages/DiagnosisPage.jsx` & `DeploymentDetailPage.jsx`)**:
  - Renders diagnosis source badges including `LLM_FALLBACK`.
  - Displays human review advisory warning banners when `needs_human: true`.
  - Visualizes Phase 2 pipeline progress: *Fetch Logs → Preprocess → Signature → Rules Engine → AI Synthesis*.
  - Verified polling hook (`pollDiagnosisStatus` in `api.js`) pauses when document is hidden and terminates cleanly on `DONE`/`FAILED`/`NOT_APPLICABLE`.

---

## 2. How to Run

### Run Full Test Suites
```bash
# 1. ai-service unit & integration tests (Vitest: 11 test suites, 76 tests)
cd ai-service
npm test

# 2. api-server test suite (node:test: 5 suites, 28 tests)
cd ../api-server
npm test
```

### Run Evaluation Harness
```bash
cd eval

# Baseline floor (all UNKNOWN)
npx tsx run.ts --mode unknown --split dev
npx tsx run.ts --mode unknown --split test

# Deterministic Rules
npx tsx run.ts --mode rules --split dev
npx tsx run.ts --mode rules --split test

# Pure LLM
npx tsx run.ts --mode llm --split dev
npx tsx run.ts --mode llm --split test

# Hybrid (Rules + LLM Fallback / Escalation)
npx tsx run.ts --mode hybrid --split dev
npx tsx run.ts --mode hybrid --split test
```

---

## 3. Baseline Evaluation Results

### Complete Comparison Table

| Split | Mode | Cases | Overall Accuracy | Root-Cause Score (0–2) | Evidence Validity | JSON Validity | Latency (p50 / mean) | Mean Cost / Case |
|---|---|---|---|---|---|---|---|---|
| **Dev** | `unknown` | 4 | **0.0%** (0/4) | 0.00 | 0.0% | 100.0% | 0ms / 0ms | $0.000000 |
| **Dev** | `rules` | 4 | **100.0%** (4/4) | 2.00 | 100.0% | 100.0% | 5ms / 14ms | $0.000000 |
| **Dev** | `llm` | 4 | **100.0%** (4/4) | 1.25 | 100.0% | 100.0% | 2003ms / 1986ms | $0.001505 |
| **Dev** | `hybrid` | 4 | **100.0%** (4/4) | 2.00 | 100.0% | 100.0% | 6ms / 15ms | $0.000000 |
| **Test** | `unknown` | 2 | **0.0%** (0/2) | 0.00 | 0.0% | 100.0% | 0ms / 0ms | $0.000000 |
| **Test** | `rules` | 2 | **50.0%** (1/2) | 0.00 | 100.0% | 100.0% | 56ms / 56ms | $0.000000 |
| **Test** | `llm` | 2 | **100.0%** (2/2) | 0.50 | 100.0% | 100.0% | 2674ms / 2674ms | $0.001648 |
| **Test** | `hybrid` | 2 | **100.0%** (2/2) | 0.50 | 100.0% | 100.0% | 1411ms / 1411ms | $0.000658 |

### Key Takeaways from the Baselines
1. **Hybrid Architecture Advantage**: On the test split, `rules` alone scored 50% because `MODULE_NOT_FOUND-03` had an unseen log signature (`Failed to compile` instead of Vite's `Build failed`). The `hybrid` mode successfully short-circuited `DEPENDENCY_CONFLICT-03` via rules (saving cost & time) and gracefully routed `MODULE_NOT_FOUND-03` to the LLM, achieving **100.0% accuracy** at half the cost ($0.000658 vs $0.001648) and half the average latency (1411ms vs 2674ms).
2. **Evidence Precision**: Across both splits and all modes, evidence citations achieved **100% validity** (all citations reference existing lines and contain verbatim matching substrings).
3. **Reliability**: 0% retry rate and 0% JSON errors across all runs.

---

## 4. Per-Category Performance Breakdown

### `DEPENDENCY_CONFLICT`
- **Dev Split**: 2/2 (100.0%)
- **Test Split**: 1/1 (100.0%)
- **Performance**: High reliability. Deterministic npm `ERESOLVE` patterns are recognized by both the rules engine and the LLM. In hybrid mode, 100% of cases short-circuit in < 60ms with zero token cost.

### `MODULE_NOT_FOUND`
- **Dev Split**: 2/2 (100.0%)
- **Test Split**: 1/1 (100.0%)
- **Performance**: High accuracy. The rules engine handles standard Rollup/Vite resolution errors (`Can't resolve`, `Cannot find module`). When an unseen build tool compiler format is encountered (e.g., webpack `Failed to compile`), the hybrid pipeline automatically falls back to the LLM and classifies correctly with 0.98 confidence.

---

## 5. Known Limitations

1. **Small Fixture Set**: The evaluation dataset currently consists of 6 fixtures (4 dev, 2 test). Accuracy metrics are directional. Additional fixtures across other taxonomy categories (`TASK_OOM`, `UNSUPPORTED_ENGINE`, `MISSING_BUILD_SCRIPT`) should be added in subsequent phases.
2. **Step Parsing in ClickHouse**: Because ClickHouse stores raw log entries without a separate `step` column, step segmentation relies on log prefix markers (e.g. `[install]`, `[build]`).
3. **Single-Worker Daily Cap**: The daily cap counter is maintained in-process. For horizontally scaled consumer clusters, this should be backed by Redis or PostgreSQL.
4. **Retrieval (RAG)**: The pipeline currently operates without vector retrieval (scheduled for Phase 3).

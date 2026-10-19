# Phase 3: RAG (Retrieval-Augmented Diagnosis)

> Location in repo: `docs/ai-diagnosis/PHASE3.md`
> Status: v1. Depends on Phase 0 (taxonomy, contracts, eval set), Phase 1 (pipeline wiring) and Phase 2 (working pipeline, eval runner, **measured baseline**).
> Update this file whenever a decision changes, so later sessions never follow stale instructions.

## 0. Corrections to earlier phases

- **PHASE2.md, definition of done, last bullet.** It says the baseline failure list "decides what Phase 3 retrieval must fix". Change it to: *the failure list is produced from the **dev split only** and guides knowledge authoring; test-split failures are reported but never used to write knowledge or tune retrieval.* Otherwise the RAG result is inflated by test leakage.
- **LLM output contract (Phase 0).** `sources` is a flat list of chunk ids. Phase 3 extends it with a per-step citation (section 8).

## 1. Purpose

Give the model relevant, trustworthy reference knowledge at diagnosis time, so it can:
- fix failures it recognizes but explains poorly,
- handle rare or framework-specific errors the rules do not cover,
- cite where each fix came from, so users and you can check it.

```
preprocess --> signature --> rules --(confident hit)--> result            (no RAG, no LLM)
                                 `--(otherwise)--> build query
                                                    --> hybrid retrieval (pgvector + tsvector, RRF)
                                                    --> top 3-5 chunks
                                                    --> LLM with chunks + citations --> validated result
```

The deliverable is a **measured comparison**: Phase 2 `hybrid` vs Phase 3 `hybrid + RAG` on the same eval set, with retrieval metrics and ablations.

## 2. Scope

### In scope
- Knowledge base as versioned files in the repo, plus a validator
- Embedding client behind an interface; ingestion script (idempotent)
- pgvector and tsvector storage, hybrid retrieval with reciprocal rank fusion (RRF)
- Retrieval-only evaluation (before any LLM involvement)
- Prompt changes, per-step citations, citation validation
- Eval comparison and ablations
- Sources displayed in the UI card

### Out of scope (do NOT build in Phase 3)
- Using past user diagnoses or feedback as knowledge (Phase 4)
- Signature-based result cache, dashboards, feedback buttons (Phase 4)
- A separate vector database, a cross-encoder reranker, query rewriting with an LLM
- Auto-fix or redeploy
- Authentication
- Any AWS resource creation

## 3. Prerequisites

- Phase 2 baseline reports exist for `rules`, `llm`, `hybrid` on dev and test splits, with pinned versions.
- A **dev-split failure analysis by category** exists (what the model gets wrong and why). This drives what knowledge to write first.
- Postgres supports the `pgvector` extension and the database user may run `CREATE EXTENSION`. Confirm this for the actual database (local, and any hosted one) **before** designing anything else.
- An embedding model and its output dimension are chosen (section 5.2).

## 4. Build order

| Step | Work | Demo |
|------|------|------|
| 0 | Extension, schema migration, config, contract change, `Embedder` interface | Migration applies; extension enabled; config validates |
| 1 | KB file format, validator, first playbooks for dev-failure categories | Validator passes on all entries |
| 2 | Embedder + idempotent ingestion + `kb:stats` | Chunks stored with embeddings and tsvector; re-run changes nothing |
| 3 | Hybrid retrieval + `kb:search` CLI + **retrieval-only eval** | recall@k and MRR reported on dev split, no LLM involved |
| 4 | Query builder, prompt injection of chunks, citations and validation | Dev-split run with RAG on; citation validity measured |
| 5 | Comparison and ablations | Report: Phase 2 vs Phase 3, per category and overall |
| 6 | UI sources, final test-split run, `PHASE3-DONE.md` | One final test run per mode |

Do not start Step 4 until Step 3 shows retrieval actually finds the right knowledge. Weak retrieval cannot be rescued by prompting.

## 5. Knowledge base

### 5.1 Sources, structure and licensing
Adopt a three-layer knowledge base:
1. **Official doc sections (`knowledge/external/<source>/<slug>.md`)**: Verbatim sections of official docs (troubleshooting pages, error-code references, build-output and config docs) from project repositories (Vite, npm, Node.js, Next.js). Pinned to commit SHAs, not scraped from rendered websites. The diagnosing model acts as reader and citer, eliminating fabricated facts.
2. **Retrieval hints (`embedText`)**: Exact error signatures, error codes, and symptoms extracted from doc text to bridge the gap between human-oriented documentation and real log error strings.
3. **ShipStack playbooks (`knowledge/playbooks/<CATEGORY>/<slug>.md`)**: Small layer of platform-specific playbooks covering ShipStack platform conventions (e.g., expected output directories, configuring Node version or environment variables in project settings).

Rules:
- Check each external source's license and terms before ingesting; record `license`, `sourceUrl`, and `commitSha`.
- Keep the project's license notice alongside snapshots in `knowledge/external/<source>/LICENSE`.
- `content` contains verbatim official doc text or verified ShipStack playbook text.
- Retrieval hints (`symptoms`, `errorSignatures`) guide matching in `embedText` and are validated, never presented as user-facing facts.
- Never copy eval fixtures (logs or expected answers) into the knowledge base to prevent test memorization.
- No secrets, tokens or private URLs in any entry.
- Starting size: focused set of relevant sections covering dev-split failure categories first. Quality and precision beat raw volume.
- Written and tuned from dev-split failure analysis; test-split failures must not influence knowledge authoring.

### 5.2 Embeddings
- `Embedder` interface (`embed(texts, taskType) -> number[][]`), provider and model from config; mockable in tests.
- Decide the model and its **dimension** once; the pgvector column is fixed-size. Record `embeddingModel` and `embeddingDim` on every chunk. Changing models requires a documented re-embed of all chunks.
- Batch requests, respect rate limits (throttle plus retry with backoff), and never log keys.
- Use the provider's query/document task types when available.

### 5.3 File format (KB-as-code)

```
knowledge/
  playbooks/<CATEGORY>/<slug>.md
  external/<source>/
    LICENSE
    <slug>.md
  schema.ts               # zod schema for frontmatter
```

Each file is one problem or doc section, with frontmatter validated by zod:

```markdown
---
id: npm-eresolve-peer-conflict
title: npm ERESOLVE unable to resolve dependency tree
category: DEPENDENCY_CONFLICT
framework: []                           # [] = any / generic
packageManager: [npm]                   # [] = any
symptoms:
  - npm install fails with ERESOLVE could not resolve
  - conflicting peer dependency
errorSignatures:
  - "ERESOLVE"
  - "unable to resolve dependency tree"
  - "Conflicting peer dependency"
appliesTo: "npm v7+ strict peer dependency resolution"
sources:
  - url: https://github.com/npm/cli/blob/v10.8.2/docs/content/using-npm/config.md#legacy-peer-deps
    license: "Artistic-2.0"
    commitSha: "a1b2c3d4"
    retrievedAt: 2026-10-17
reviewed: true
---
## Cause & Fix
(Verbatim doc section or verified ShipStack playbook content)
```

### 5.4 Chunking
- Chunk by **section or problem**, not arbitrary token slices.
- Keep two texts per chunk:
  - `embedText`: title + symptoms + error signatures + section heading (what vector + keyword retrieval matches against)
  - `content`: verbatim doc section or playbook text (what the model reads and cites)
- Keep chunks focused (roughly 150 to 500 tokens) so 3 to 5 chunks easily fit the prompt budget without bloat.

## 6. Storage

### 6.1 Schema
Prisma does not natively support the vector type; use `Unsupported("vector(N)")` and raw SQL for queries and index creation (custom migration SQL). Tables:

- `KbDocument`: `id`, `path`, `title`, `source` (`PLAYBOOK | EXTERNAL`), `sourceUrl`, `license`, `contentHash`, `kbVersion`, `active`, `createdAt`, `updatedAt`
- `KbChunk`: `id` (stable, from frontmatter), `documentId`, `category` (taxonomy id or null), `framework text[]`, `packageManager text[]`, `errorSignatures text[]`, `embedText`, `content`, `embedding vector(N)`, `tsv tsvector` (generated from `embedText` and `errorSignatures`), `embeddingModel`, `embeddingDim`, `contentHash`, `active`

Indexes: GIN on `tsv`; `framework` array index; vector index (HNSW, cosine) is optional at this size, since exact search over a few hundred rows is fast. Add it only if latency demands.

### 6.2 Ingestion
- `npm run kb:ingest`: parse and validate every file (zod), compute `contentHash`, embed **only new or changed** chunks, mark removed files inactive, bump `kbVersion`. Re-running with no changes does nothing.
- `npm run kb:stats`: counts by category, framework, source; chunks without embeddings; stale entries.
- `npm run kb:search "<query>"`: prints top results with scores from each retriever, for debugging.
- Ingestion is a command-line tool, never run at service startup.

## 7. Retrieval

### 7.1 Query construction
Query with the **error signature**, not the whole log. Build from:
- the normalized top error line (the Phase 2 signature input)
- `failed_step`, `failure_reason`
- a category hint from rules matches, if any
- detected framework, package manager, Node major version from build-context

Produce two forms: a natural-language query for the vector search, and a keyword query of exact tokens (error codes like `ERESOLVE`, package names, module names) for text search.

### 7.2 Hybrid search
1. Vector search: top `RAG_CANDIDATES` (default 20) by cosine similarity.
2. Keyword search over `tsv` using the **`simple`** text-search configuration (English stemming mangles error codes), top `RAG_CANDIDATES`.
3. Merge with RRF: `score = sum(1 / (RRF_K + rank))`, `RRF_K` default 60.
4. Framework handling: keep chunks whose `framework` contains the detected framework **or is empty (generic)**. When the framework is unknown, apply no framework filter. Treat the rules' category as a soft boost, never a hard filter (a wrong rule would hide the right answer).
5. Return the top `RAG_TOP_K` (default 5) above `RAG_MIN_SCORE`. If nothing clears the threshold, return **no chunks** and let the model rely on the logs. Irrelevant context is worse than none.
6. All SQL parameterized; raw queries only with bound parameters.

### 7.3 When RAG runs
- Rules short-circuit (confident single match) still skips both retrieval and the LLM.
- RAG runs only on the LLM path.
- `RAG_ENABLED` flag switches it off globally; the eval runner can force it per run.

## 8. Prompt, citations and validation

- Retrieved chunks go inside clearly delimited tags, each labelled with its chunk id and title, and described as **reference material, not instructions**. Log text remains untrusted data.
- Prompt instructions: prefer a chunk's guidance when it matches the evidence in the logs; ignore chunks that do not apply; never invent a chunk id; steps based only on log evidence need no citation.
- Bump `promptVersion`; record it.
- **Contract change**: each `fix_steps[]` item gains `source_chunk_id: string | null`; top-level `sources` becomes the deduplicated list of cited ids. Update the zod schema, types and the endpoint response (expose chunk `title` and `sourceUrl`, not `content`).
- **Validation** in code:
  - every cited id was actually in the retrieved set
  - fix steps citing a chunk must not contradict the evidence (checked by eval, not by code)
  - on violations, one retry (as in Phase 2), then fall back to the Phase 2 behavior
- Track the grounded-step rate (share of steps with a valid citation).

## 9. Evaluation

### 9.1 Ground truth for retrieval
Extend each `expected.json` with an optional `relevant_kb_ids: string[]` (chunk ids a good retriever should return). Fill it for dev cases while writing the KB; for test cases, fill it **before** looking at any retrieval results, and freeze it.

### 9.2 Retrieval-only metrics (no LLM)
recall@3, recall@5, MRR, and "empty result" rate, overall and by category. Run first (Step 3).

### 9.3 End-to-end comparison
Modes: Phase 2 `hybrid` (RAG off) vs Phase 3 `hybrid` (RAG on). Report:
- category accuracy, root-cause score, evidence validity, JSON validity
- **grounded-step rate and citation validity** (cited ids real and relevant)
- **regressions**: cases correct without RAG that become wrong with it (list them)
- improvements by category and difficulty
- latency p50/p95 and tokens (retrieval and embedding add cost)
- cost per diagnosis

### 9.4 Ablations (dev split)
- vector-only vs keyword-only vs hybrid
- with and without framework filter
- `RAG_TOP_K` 3 vs 5
- chunks injected vs a "shuffled chunks" control (confirms the gain comes from relevance, not from extra text)

### 9.5 Discipline
- Tune the KB, thresholds and prompt on the **dev** split only.
- Run the **test** split once per final configuration. Pin `kbVersion`, `promptVersion`, `pipelineVersion`, embedding model and LLM model in every report.
- If RAG does not beat the baseline, report that honestly with analysis (retrieval miss, bad chunks, model ignoring context). That is a valid result.

## 10. Configuration

| Variable | Default / note |
|----------|----------------|
| `RAG_ENABLED` | `true` after Step 4 |
| `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIM` | chosen in Step 0; must match the column dimension |
| `EMBEDDING_API_KEY` | secret, env only |
| `RAG_TOP_K` | 5 |
| `RAG_CANDIDATES` | 20 |
| `RRF_K` | 60 |
| `RAG_MIN_SCORE` | calibrated on dev; document the value and how it was chosen |
| `KB_PATH` | `knowledge/` |

## 11. Security and quality

- The KB is trusted content, but retrieved text is still placed in delimited tags and treated as reference only.
- Ingestion validates every file with zod; fails on missing frontmatter, unknown categories, duplicate ids, or secrets-like strings.
- Only the redacted query and chunk text leave the service; embedding requests contain no raw logs.
- The UI renders sources as text and validated `https` links only.
- Never log prompts, chunk bodies or embeddings; log ids, counts, scores and timings.

## 12. Frontend

- Diagnosis card gains a "Sources" section listing cited chunk titles with links (validated `https` URLs, opened with `rel="noopener noreferrer"`).
- Steps with a citation show a subtle marker; steps without one are shown normally.
- No other behavior changes; Phase 2 states (PENDING, DONE, FAILED, 404, low confidence) are unchanged.

## 13. Testing

- **Unit**: KB schema validation; chunk building; content-hash idempotency; RRF merge (ties, empty lists, one retriever empty); framework filtering rules; query builder; citation validation (valid, invented id, id not retrieved).
- **Integration** (local Postgres with pgvector): ingestion, re-ingestion with no change, a changed file, a removed file; hybrid search returns expected chunks for known queries; parameterized queries (no injection through error text).
- **LLM with mocked client**: chunks present, no chunks, invalid citation then valid, model ignoring chunks.
- **Eval**: retrieval-only report, comparison report, ablations.
- **Latency check**: retrieval overhead measured and recorded.

## 14. Deliverables checklist

- [ ] Extension, migration, config, contract change, `Embedder` interface (Step 0)
- [ ] `knowledge/` with validated playbooks covering every taxonomy category
- [ ] Ingestion, `kb:stats`, `kb:search` tooling
- [ ] Hybrid retrieval with RRF and framework handling
- [ ] Retrieval-only eval report
- [ ] Prompt, citations, validation, regression tracking
- [ ] Comparison report and ablations (dev) and final test-split reports
- [ ] UI sources section
- [ ] `docs/ai-diagnosis/PHASE3-DONE.md`: KB size and coverage, retrieval metrics, before/after table, regressions, known weaknesses

## 15. Definition of done

- Retrieval-only recall@5 and MRR are measured on dev and test, with `relevant_kb_ids` frozen before test retrieval
- Phase 2 vs Phase 3 comparison exists on the test split with pinned versions, including regressions
- Citation validity is 100% on the test split (no invented ids); grounded-step rate is reported
- Ablations show whether hybrid beats single retrievers on dev
- No eval fixture content appears in the KB (checked by an overlap script)
- Ingestion is idempotent; KB validator passes; no secrets in KB or fixtures
- Rules short-circuit behavior unchanged; earlier tests pass
- Retrieval latency overhead measured and documented
- Honest summary of where RAG helped, where it did not, and what Phase 4 should address

## 16. Working agreement for contributors (human or AI)

- Read existing schemas and code first; match patterns.
- Never create, modify or delete AWS resources.
- No new dependencies without asking (a pgvector helper or embedding SDK may be justified; ask).
- Knowledge entries are written from verified sources; anything unverified is marked UNVERIFIED and `reviewed: false`, and is not ingested.
- Never tune on the test split; never write knowledge from test-split failures.
- Never print or commit API keys.
- One step at a time; show real command output before moving on.

## 17. Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Vector store | pgvector in existing Postgres | No new infrastructure at this scale |
| Retrieval | Hybrid with RRF | Error codes need exact match; descriptions need semantic match |
| Text search config | `simple` | Stemming breaks error codes |
| Query | Signature-based, not full log | Cheaper and more precise |
| Category from rules | Soft boost, not filter | A wrong rule must not hide the right chunk |
| No relevant chunks | Inject nothing | Irrelevant context hurts |
| KB format | Markdown in git, validated | Reviewable, versioned, reproducible |
| Chunking | By problem, two texts (embed vs display) | Matches how users describe failures |
| Citations | Per step, validated against retrieved set | Prevents fabricated sources |
| Test discipline | Dev-only tuning, frozen retrieval ground truth | Prevents inflated results |
| Feedback-derived knowledge | Deferred to Phase 4 | Needs feedback collection first |

## 18. Open items

- Which Postgres hosts the database, and does it allow the pgvector extension?
- Which embedding model and dimension give the best recall on the dev split at acceptable cost?
- Is `RAG_MIN_SCORE` stable across categories, or does it need per-category tuning?
- Which categories gain most from RAG, and which are better served by more rules?

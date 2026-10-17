# Using official docs as the RAG knowledge source

Oct 17, 2026 · @Explain some topics with examples

## Short answer

Yes: use official documentation as the knowledge source, and add a small layer of hand-written ShipStack content. Retrieval then returns text a maintainer wrote, with a link back to it, so the diagnosing model never has to invent a fact. Official docs alone have gaps, covered below.

## What changes with real doc text

The model's role shifts from author to reader. Each chunk's content is a verbatim section of an official page, and the diagnosing LLM reads that text and cites it.

- The risk of a confidently wrong "fact" about Vite or npm largely disappears.
- What remains is a retrieval-quality problem, which the retrieval-only eval (recall@k, MRR) measures.
- You no longer review every entry for correctness, only the retrieval hints (see below).

## Where official docs fall short

Official docs are written for humans, not for matching error logs, so four gaps need a plan.

1. **Error matching.** A page on Vite's build options may never contain the string a user's log prints, so semantic search can miss it. Error reference and troubleshooting pages match much better; start there.
2. **Platform specifics.** Docs can say a tool outputs to `dist`. They cannot say what ShipStack expects, how to set the Node version on ShipStack, or what your task memory limit is. Those are often the actual fixes.
3. **Page length.** Pages cover many topics, so you must chunk by heading, and a chunk can still be too generic.
4. **Versions.** Docs change between releases, so you need to pin which version you indexed.

## Recommended approach: three layers

Combine verbatim doc sections with short retrieval hints and a few ShipStack playbooks. The Phase 3 schema already separates `embedText` (what matching uses) from `content` (what the model reads), so this needs no redesign.

| Layer | Source | Who writes it | Risk |
| --- | --- | --- | --- |
| Official doc sections (`content`) | Troubleshooting pages, error-code references, build-output and config docs | Nobody; verbatim text with a source link | Low, but check each license |
| Retrieval hints (`embedText`) | A few symptoms and exact error strings per section | You, optionally drafted by a model and checked | Low; hints only affect matching and are never shown as fact |
| ShipStack playbooks | How to fix things on your platform | You, as the authority on your own code | Low, because you verify against your platform |

In practice `content` becomes the verbatim doc section, and `embedText` becomes the section heading plus the retrieval hints.

## How to get the docs cleanly

Use the Markdown source from each project's repository, pinned to a commit, not the rendered website.

- **Markdown sources.** Many of these projects publish their docs as Markdown in their GitHub repos (Vite, npm's CLI, Node.js and Next.js have docs folders in their main repos). Check the exact paths and each repo's license first.
- **Pin a commit SHA** per source and keep a snapshot under `knowledge/external/<source>/`. Ingestion becomes reproducible, and you can re-run it when a project releases a new version.
- **Record metadata per chunk:** `license`, `sourceUrl` with the section anchor, `commitSha` and `retrievedAt`.
- **Respect licenses.** Most are permissive, but some require attribution or a license notice, so keep each project's license file with its snapshot.
- **Do not scrape rendered websites.** The Markdown source is cleaner, versioned, and avoids terms-of-service issues.
- **Limit the first pass** to sections about errors and troubleshooting. A smaller, relevant set beats indexing everything.

## How a model can still help, safely

A model can propose retrieval hints, but it never writes the fix text.

- It proposes symptoms and error strings only from the doc text you give it.
- A validator checks that each error string is something that could appear in a real log.
- You review the hints, which is much faster than reviewing full written entries.
- Hints affect only what gets retrieved. They are never shown to users as fact.

## What this does to the evaluation

Retrieval-only recall@5 tells you immediately whether the doc-based approach works. If a category scores poorly, the docs do not contain what users' logs look like for that failure, and that is exactly where a short ShipStack playbook should fill the gap. The same discipline applies as before: tune on the dev split only, and never write knowledge from test-split failures.

## Next steps

Two files change if you adopt this approach.

- [ ] Update `PHASE3.md` sections 5.1, 5.3 and 5.4 for doc snapshots: pinned commits, verbatim `content`, and hint-only authoring.
- [ ] Replace the authoring prompt in `PHASE3-PROMPT.md` with a hint-extraction prompt that forbids writing fix text.
- [ ] Check the license of each source before adding it to `knowledge/external/`.

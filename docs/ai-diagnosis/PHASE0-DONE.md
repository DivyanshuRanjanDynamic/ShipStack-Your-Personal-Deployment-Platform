# Phase 0: DONE

This document summarizes the foundations built during Phase 0 for the AI deployment diagnosis feature.

## What was built

1. **Taxonomy & Schemas (`ai-service/`)**
   - **`taxonomy/taxonomy.json`**: Defined 12 failure categories + `UNKNOWN`.
   - **Contracts**: Zod schemas for Kafka payloads (`diagnosis-requests`), LLM output, and `build-context.json`.
   - All schemas are strongly typed and covered by `vitest` unit tests.

2. **Database Schema (`api-server/`)**
   - Added the `Diagnosis` model to the Prisma schema.
   - Generated the additive migration SQL file `20261010000000_add_diagnosis` which safely adds the table alongside `Deployment`.

3. **Build Server Enhancements (`build-server/`)**
   - Split the monolithic `npm install && build` step into observable boundaries (`clone`, `install`, `build`, `upload`).
   - Every Kafka log message now carries a `step` identifier.
   - **`build-context.json`**: After cloning, the server infers the framework, node version, and scripts, and streams this context JSON to S3 (`__meta/{DEPLOYMENT_ID}/build-context.json`).
   - **Backward Compatibility**: The existing `api-server` log consumer destructures JSON in a way that ignores the new `step` and `event` fields without crashing.

4. **Evaluation Scaffolding (`eval/`)**
   - Created folder structures for base `fixtures` and mutation `patches`.
   - Implemented Zod schema validation for `expected.json`.
   - Created 6 high-fidelity manual cases (3 for `DEPENDENCY_CONFLICT`, 3 for `MODULE_NOT_FOUND`) to validate the tooling.
   - Built a robust validation script (`scripts/validate.ts`) to ensure logs, contexts, and ground truths are correctly formatted.

## How to run the code

### 1. Run taxonomy & contract unit tests
Navigate to the `ai-service` directory:
```bash
cd ai-service
npm install
npm test
```
*Note: This runs the vitest suite against the taxonomy definitions and all Zod schemas.*

### 2. Apply Database Migrations
If your Aiven database is running and accessible:
```bash
cd api-server
npx prisma migrate dev
```
*(If the DB is unreachable, the SQL file has already been generated in `prisma/migrations/20261010000000_add_diagnosis/migration.sql` and can be manually executed).*

### 3. Run the Evaluation Validator
To ensure all evaluation cases in `eval/cases/` meet the required schema:
```bash
cd eval
npm install
npm run validate
```
This script will parse every `expected.json` and `build-context.json` against the Phase 0 Zod schemas and verify that `logs.txt` is present and non-empty.

## Next Steps (Phase 1)
- Wire up the EventBridge trigger to track `TASK_OOM` and `TIMEOUT` exit reasons.
- Implement the Kafka consumer in `ai-service` that listens to deployment failures.
- Begin integrating the LLM prompt layer using the schemas defined here.

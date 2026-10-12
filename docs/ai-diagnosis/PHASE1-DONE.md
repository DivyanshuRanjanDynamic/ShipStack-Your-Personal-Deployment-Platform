# Phase 1: DONE — Walking Skeleton for AI Deployment Diagnosis

This document summarizes the end-to-end walking skeleton implemented in Phase 1 for ShipStack's AI deployment diagnosis pipeline.

---

## What was built

1. **Step 0: Contract Fix & Prisma Model Updates**
   - [`ai-service/contracts/diagnosis-request.ts`](file:///c:/Users/Divyanshu/Projects/shipStack/ai-service/contracts/diagnosis-request.ts): `user_id` made nullable (`z.string().nullable()`), and added optional nullable fields `stop_code` and `stopped_reason`.
   - [`ai-service/contracts/steps.ts`](file:///c:/Users/Divyanshu/Projects/shipStack/ai-service/contracts/steps.ts): Added `"STUB"` to `DiagnosisSource` enum.
   - [`api-server/prisma/schema.prisma`](file:///c:/Users/Divyanshu/Projects/shipStack/api-server/prisma/schema.prisma): Added `ecsTaskArn`, `startedAt`, `deadlineAt`, `timedOut`, `stopCode`, and `stoppedReason` to the `Deployment` model.
   - Additive migration SQL created in `api-server/prisma/migrations/20261010000001_add_deployment_phase1_fields/migration.sql`.

2. **Step 1: Status & Diagnosis API Endpoint**
   - Implemented `GET /deployments/:id/diagnosis` in `api-server` (`api-server/routes/diagnosis.js`), mounted in `index.js`.
   - Handles all required status transitions:
     - 404 for unknown deployment.
     - 200 `NOT_APPLICABLE` for non-failed deployments.
     - 200 `PENDING` when deployment failed but diagnosis is in-progress or not yet created.
     - 200 `DONE` returning validated diagnosis payload (stripping internal tokens/model/hash fields).
     - 200 `FAILED` returning a user-safe error message.
   - Sends `Cache-Control: no-store` on all polling responses.

3. **Step 2: `ai-service` Skeleton & Stub Pipeline**
   - Config module with startup validation in `ai-service/src/config.ts`.
   - 6-step stub pipeline in `ai-service/src/pipeline/`:
     1. `fetchContext.ts`
     2. `preprocess.ts`
     3. `signature.ts`
     4. `rules.ts`
     5. `retrieve.ts` (no-op)
     6. `diagnose.ts` (returns valid `LlmOutput` with `source: STUB`, category `UNKNOWN`, root cause `"stub diagnosis..."`)
     - Orchestrated in `index.ts`.
   - Kafka consumer in `ai-service/src/consumer.ts` with consumer group `ai-service-diagnosis`:
     - Zod contract validation with invalid payloads routed to `diagnosis-requests.dlq`.
     - Idempotent deduplication (skips deployments already `DONE`).
     - Up to 3 retries with backoff on pipeline errors before dead-lettering.
     - Commits offsets only after writing DB record or routing to DLQ.
   - CLI script `ai-service/scripts/publish-test-message.ts`.

4. **Step 3: Layer A Failures in `api-server`**
   - `POST /deploy` tags ECS task with `deployment_id`.
   - Validates `response.failures` and throws if `!taskArn`.
   - Persists `ecsTaskArn` to PostgreSQL.
   - Non-blocking publisher (`api-server/src/publisher.js`) publishes `diagnosis-requests` on `POST /deploy` catch or Kafka step failure log markers.

5. **Step 4: Layer B (Event Mapper, Watchdog, SQS Poller)**
   - Event fixtures captured from real ECS events in `api-server/test/fixtures/ecs-events/`:
     - `task-running.json`
     - `task-stopped-success.json`
     - `task-stopped-nonzero-exit.json`
     - `task-stopped-oom.json`
     - `task-stopped-start-failure.json`
     - `task-stopped-watchdog-timeout.json`
   - Pure function event mapper `api-server/src/event-mapper.js` implementing strict priority order (watchdog `timedOut` flag first, followed by OOM, nonzero exit, start failure, and clean exit 0).
   - Watchdog service `api-server/src/watchdog.js` enforcing build deadlines with atomic conditional updates (`updateMany` with `timedOut = false` -> `timedOut = true`) before calling `StopTask`.
   - SQS poller `api-server/src/sqs-poller.js` running 20s long-polling, race-tolerant (never deletes unmatched task ARNs so SQS redrives them), and deduplicating already-diagnosed deployments.

---

## How to Run Tests

### 1. Run `ai-service` tests
```bash
cd ai-service
npm test
```
*Runs all Vitest unit tests covering taxonomy, zod contracts, 6-step stub pipeline, DLQ forwarding, retries, and consumer idempotency.*

### 2. Run `api-server` tests
```bash
cd api-server
npm test
```
*Runs all native `node:test` suites covering the GET diagnosis endpoint, fixture-driven event mapping, Layer A publisher, SQS poller handler, and watchdog atomic timeout enforcement.*

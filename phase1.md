# Phase 1: Walking Skeleton for AI Deployment Diagnosis

> Location in repo: `docs/ai-diagnosis/PHASE1.md`
> Status: v2. Depends on Phase 0 (taxonomy, contracts, `Diagnosis` model, step markers, build-context).
> Update this file whenever a decision changes, so later sessions never follow stale instructions.

## 1. Purpose

Prove the whole diagnosis loop end to end with **stubbed intelligence**:

```
failed deployment --> diagnosis-requests (Kafka) --> ai-service --> Diagnosis row --> GET endpoint --> frontend polling
```

Phase 1 delivers wiring, idempotency and failure detection. It does not deliver real diagnosis quality; that is Phase 2.

## 2. Scope

### In scope
- `GET /deployments/:id/diagnosis` endpoint in `api-server`
- `ai-service` scaffold: Kafka consumer group, message validation, six-step pipeline skeleton with stub steps
- Publishing `diagnosis-requests` from the API server when a failure is known (Layer A)
- SQS poller that turns ECS task-state events into diagnosis requests (Layer B)
- Task-to-deployment mapping, `startedAt` tracking, and a build watchdog
- Idempotency, retries, dead-letter handling

### Out of scope (do NOT build in Phase 1)
- Real log preprocessing, rules classifier, LLM calls (Phase 2)
- Retrieval, embeddings, pgvector (Phase 3)
- Signature cache, feedback, dashboards (Phase 4)
- Frontend diagnosis card beyond a minimal polling hook
- Authentication (explicitly deferred, see section 11)
- **Any AWS resource creation.** The SQS queues, EventBridge rule and IAM permissions are created manually in the AWS console by the project owner. Code must assume they exist (section 3).

## 3. Prerequisites: AWS resources (created manually, not by code)

The project owner creates these by hand in the AWS console, in region **eu-north-1 (Stockholm)**, the same region as the ECS cluster. Code and agents must **not** create, modify or delete AWS resources; they only consume them through environment variables.

| Resource | Name | Settings the code depends on |
|----------|------|------------------------------|
| SQS queue (main) | `shipstack-ecs-events` | Long polling 20 s, visibility timeout 60 s, redrive to DLQ after 5 receives |
| SQS queue (DLQ) | `shipstack-ecs-events-dlq` | Retention 14 days |
| EventBridge rule | `shipstack-ecs-task-state` on the **default** bus | Pattern: source `aws.ecs`, detail-type `ECS Task State Change`, this cluster only, `lastStatus` in `RUNNING`, `STOPPED` |
| IAM (API server credentials) | inline policy `shipstack-phase1` | `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on the queue; `ecs:StopTask`, `ecs:DescribeTasks`, `ecs:TagResource` on tasks in the build cluster |

Deliverable: `docs/ai-diagnosis/AWS-SETUP.md`, a short checklist recording the resource **names, region and settings above** so the setup is reproducible. It must never contain access keys, secrets or account-specific credentials.

Because the visibility timeout is 60 s, the poller's worst-case processing time per message must stay well under that.

## 4. Build order

Each step ends with something demonstrable. Do not start a step until the previous one passes its checks.

| Step | Work | Demo |
|------|------|------|
| 0 | Contract fix (`user_id` nullable) and Prisma migration | Contract tests pass, migration applies |
| 1 | API endpoint and status model | `curl` returns the correct status for every state |
| 2 | `ai-service` skeleton with stub pipeline | A hand-published Kafka message becomes a `DONE` row |
| 3 | Layer A: tag task, save task ARN, publish on known failures | Break a repo, see a diagnosis row appear |
| 4 | Layer B: SQS poller, event mapper, watchdog | Force an OOM and a timeout, see them diagnosed |

If step 4 stalls, steps 1 to 3 still cover most failures. Layer B only adds what the container cannot report about itself.

## 5. Step 0: Contract and schema changes

1. `ai-service/contracts/diagnosis-request.ts`: change `user_id` to nullable (`z.string().nullable()`). Update the inferred type and contract tests (valid with `null`, valid with a string, invalid when missing). Publish `null` when no user is known; never invent a placeholder id.
2. Add optional nullable fields to the same contract: `stop_code`, `stopped_reason`.
3. `Diagnosis.source`: allow `STUB`.
4. `Deployment` model: add the fields below, then migrate. All nullable or defaulted.

```prisma
ecsTaskArn     String?   @unique
startedAt      DateTime?
deadlineAt     DateTime?
timedOut       Boolean   @default(false)
stopCode       String?
stoppedReason  String?
```

5. DLQ message shape for Kafka: `{ original_message, error, received_at }` on topic `diagnosis-requests.dlq`.

Note: match the **existing** deployment status values in the code (for example the API server currently writes `'FAILURE'`, not `'FAILED'`). Do not introduce a second spelling.

## 6. Step 1: API endpoint

`GET /deployments/:id/diagnosis` in `api-server` (plain JavaScript today; match the existing style).

| Condition | HTTP | Body `status` |
|-----------|------|---------------|
| Deployment unknown | 404 | – |
| Deployment not failed | 200 | `NOT_APPLICABLE` |
| Failed, no diagnosis row yet | 200 | `PENDING` |
| Diagnosis row `PENDING` | 200 | `PENDING` |
| Diagnosis complete | 200 | `DONE` plus diagnosis payload |
| Diagnosis errored | 200 | `FAILED` plus a user-safe message |

`DONE` response shape:

```json
{
  "status": "DONE",
  "diagnosis": {
    "category": "NODE_VERSION_MISMATCH",
    "confidence": 0.82,
    "root_cause": "string",
    "fix_steps": [{ "step": "string", "type": "config" }],
    "evidence": [{ "line": 142, "text": "string" }],
    "source": "STUB | RULES | LLM | CACHE"
  }
}
```

Rules:
- Validate the response with the Phase 0 zod schemas before sending.
- Never expose internal fields (`tokensIn`, `model`, `signatureHash`).
- Send `Cache-Control: no-store` so polling sees fresh state.
- No auth, so no 403 case. The deployment id is the access key, so ids must be unguessable.

## 7. Step 2: `ai-service` skeleton

### Layout

```
ai-service/
  src/
    config.ts            # typed env config, fails fast on missing vars
    consumer.ts          # Kafka consumer group, commit logic
    pipeline/
      index.ts           # runs the six steps in order
      fetchContext.ts    # 1. fetch logs + build-context (stub)
      preprocess.ts      # 2. clean/redact/trim (stub)
      signature.ts       # 3. signature hash + cache lookup (stub)
      rules.ts           # 4. rules classifier (stub)
      retrieve.ts        # 5. hybrid retrieval (stub, no-op)
      diagnose.ts        # 6. LLM call (stub, returns fixed result)
    store/diagnosis.ts   # Prisma access
    logger.ts
  test/
  scripts/publish-test-message.ts
```

### Consumer behavior
- Consumer group id `ai-service-diagnosis` (configurable).
- Validate every message with the zod contract. Invalid messages go to `diagnosis-requests.dlq` with the validation error; never crash.
- Message key is `deployment_id`.
- Commit offsets only after the `Diagnosis` row is written.
- Graceful shutdown: stop consuming, finish the in-flight message, disconnect.

### Idempotency
- On receipt, upsert `Diagnosis` by `deploymentId` with status `PENDING`.
- If the row is already `DONE`, skip the pipeline and commit.
- The `deploymentId @unique` constraint is the backstop.

### Stub pipeline
Each step logs its name, input size and duration and returns canned data. The final stub writes a `DONE` row with `source: STUB`, category `UNKNOWN`, and a recognisable root cause such as "stub diagnosis". Stubs are allowed **only** in these six steps and must be clearly labelled.

### Failure handling
- Pipeline exception: retry up to 3 times with backoff, then mark the row `FAILED` and publish to the DLQ.
- Poison messages never block a partition.

## 8. Step 3: Layer A (failures the API server already knows)

### 8.1 Changes to the `POST /deploy` handler

1. **Tag the task** in `RunTaskCommand`: add `tags: [{ key: 'deployment_id', value: <deployment id> }]`. Everything else in the command is unchanged.
2. **Check `RunTask` failures.** A successful HTTP response can still start nothing (no capacity, bad subnet); those come back in `response.failures`. If `response.tasks?.[0]?.taskArn` is missing, throw an error that includes `response.failures?.[0]?.reason`, so the existing `catch` marks the deployment failed. Without this check the deployment stays `QUEUED` forever and no ECS event ever arrives.
3. **Save the task ARN** on the deployment (`ecsTaskArn`). This is the primary mapping from an ECS event to a deployment. A failure to save must be logged but must not fail the request, because the build is already running.
4. In the existing `catch` block, after marking the deployment failed, publish a `diagnosis-requests` message with `failure_reason: NONZERO_EXIT` (or the more specific reason) and `failed_step: clone`.

Reference shape:

```javascript
try {
    const response = await ecsClient.send(command);

    const taskArn = response.tasks?.[0]?.taskArn;
    if (!taskArn) {
        const reason = response.failures?.[0]?.reason || 'No task was started';
        throw new Error(`ECS did not start a task: ${reason}`);
    }

    await prisma.deployment
        .update({ where: { id: deployment.id }, data: { ecsTaskArn: taskArn } })
        .catch((e) => console.error('Failed to save ecsTaskArn:', e));

    return res.json({ status: 'queued', data: { deploymentID: deployment.id } });
} catch (err) {
    // existing handling: mark deployment failed, return 500
    // new: publish diagnosis-requests (non-blocking)
}
```

Use the real variable names from the file (the existing code spells it `newDeploymnet`; do not rename unrelated code).

### 8.2 Publishing rules
- Publish only if no `Diagnosis` row exists for the deployment.
- Build the message from the contract, including `failed_step`, `exit_code`, `failure_reason`, `context_s3_key`.
- Publishing must not block or fail the status update. If Kafka is down, log and retry in the background; the deployment still shows as failed.
- Key by `deployment_id`.
- Also publish when the build-server reports a failed step or `UPLOAD_EMPTY` through the Phase 0 signals.

## 9. Step 4: Layer B (SQS poller, event mapper, watchdog)

Covers what a container cannot report about itself: OOM kills, tasks that never start, tasks stopped with no final log line, timeouts.

### 9.1 Event path

```
ECS Task State Change --> EventBridge rule --> SQS queue --> API server poller --> diagnosis-requests
                                                   `--> SQS DLQ after 5 failed receives
```

The SQS poller **stays** even when the API server is hosted publicly: polling is an outbound connection, SQS retains events while the server restarts, and an HTTPS API destination would add an inbound endpoint and a 5-second response limit. Revisit only if the API server moves to a scale-to-zero platform.

### 9.2 Poller
- Runs inside `api-server` as a background loop started at boot, with a clean stop on shutdown.
- Calls `ReceiveMessage` with `WaitTimeSeconds: 20` and `MaxNumberOfMessages` up to 10. Always pass `WaitTimeSeconds` explicitly so an accidental 0 never causes busy polling.
- Delete a message only after its handling has succeeded.
- Malformed or unrecognised messages are not deleted (they reach the SQS DLQ after 5 receives) and are logged with the message id.
- Verify field names against **real captured events** (see section 12), not memory.

### 9.3 Event handling

Fields expected in the event `detail`: `taskArn`, `lastStatus`, `startedAt`, `stoppedAt`, `stopCode`, `stoppedReason`, `containers[].exitCode`. Confirm against captured samples.

| Event | Action |
|-------|--------|
| `lastStatus = RUNNING` | Find deployment by `taskArn`; set `startedAt` and `deadlineAt = startedAt + BUILD_DEADLINE_MINUTES` (only if not already set) |
| `lastStatus = STOPPED` | Find deployment by `taskArn`; record `stopCode`, `stoppedReason`; decide success or failure; if failed, publish `diagnosis-requests` |

### 9.4 Mapping a STOPPED event to `failure_reason`

Evaluate in this order:

| Condition | `failure_reason` |
|-----------|------------------|
| Deployment `timedOut = true` | `TIMEOUT` |
| Container exit code 137 or OOM text in `stoppedReason` | `TASK_OOM` |
| Container exit code non-zero | `NONZERO_EXIT` |
| Task stopped before any container started (image pull, capacity) | `NONZERO_EXIT`, with `stopCode` recorded |
| Exit code 0 | Not a failure here; `UPLOAD_EMPTY` is decided by the Layer A path |

Timeouts are identified by the **`timedOut` flag in the database**, not by parsing the `StopTask` reason text.

### 9.5 Race tolerance
A task that fails to start can stop within seconds, possibly before `ecsTaskArn` is saved. If no deployment matches an event's task ARN, **do not delete the message**; leave it for retry after the visibility timeout. After 5 receives it reaches the DLQ. Never guess a deployment.

### 9.6 Delivery semantics
- Events are at-least-once and may arrive out of order or after Layer A already handled the failure.
- Before publishing, check for an existing `Diagnosis` row and for a deployment already in a terminal state. If a diagnosis already exists, drop the event and log at debug level.
- Publish to Kafka first, then delete the SQS message.

### 9.7 Watchdog
ECS has **no built-in task timeout**, so the API server enforces one.
- A periodic job (every 30 s) finds in-progress deployments with `deadlineAt < now` and `timedOut = false`.
- For each, run an atomic conditional update (`updateMany` where `timedOut = false`, set `timedOut = true`). Only the caller whose update affected one row proceeds to call `StopTask`. This keeps multiple API instances safe.
- Call `StopTask` with a descriptive reason (for logging only; logic must not depend on it).
- Also stop tasks that never reached `RUNNING` within `PROVISIONING_DEADLINE_MINUTES` of creation, using the same conditional update.
- The resulting STOPPED event then maps to `TIMEOUT` through the flag.

## 10. Configuration

New environment variables, validated at startup (fail fast with a clear message):

| Variable | Used by | Default / note |
|----------|---------|----------------|
| `DIAGNOSIS_TOPIC` | api-server, ai-service | `diagnosis-requests` |
| `DIAGNOSIS_DLQ_TOPIC` | ai-service | `diagnosis-requests.dlq` |
| `KAFKA_GROUP_ID` | ai-service | `ai-service-diagnosis` |
| `SQS_QUEUE_URL` | api-server | from AWS console |
| `AWS_REGION` | api-server | `eu-north-1` |
| `BUILD_DEADLINE_MINUTES` | api-server | 15 |
| `PROVISIONING_DEADLINE_MINUTES` | api-server | 10 |
| `MAX_DIAGNOSES_PER_DAY` | api-server / ai-service | generous default; becomes important in Phase 2 |

Never commit `.env` files. No secrets in code or fixtures. IAM is configured manually (section 3).

## 11. Security posture (no authentication in v1)

- There is no per-user auth and none is being added now. A deployment id acts as the access key, so ids must be unguessable (cuid or uuid, never sequential).
- `POST /deploy` is unauthenticated, so anyone who can reach it can trigger builds and diagnoses. Add a simple global daily cap on diagnoses (`MAX_DIAGNOSES_PER_DAY`) so LLM cost cannot run away in later phases, and consider per-IP rate limiting on `POST /deploy`.
- Revisit all of this before the platform is widely exposed.

## 12. Testing

### Fixtures
Capture **real** ECS events from the queue (SQS console, Send and receive messages, Poll for messages) for these cases and save them under `api-server/test/fixtures/ecs-events/`:
normal success, normal failure, OOM kill, task that failed to start, watchdog stop. Remove account ids from fixtures if they will be committed.

### Unit
- zod validation (valid and invalid messages, `user_id` null)
- event-to-`failure_reason` mapping, including precedence of `timedOut`
- idempotent upsert
- poller handling: success deletes message, unmatched task ARN does not delete, malformed message does not delete

### Integration (local Kafka and Postgres)
- Hand-published message becomes a `DONE` row.
- Duplicate message does not create a second row.
- Invalid message lands in the DLQ.
- Restarting `ai-service` mid-message loses nothing and duplicates nothing.

### Manual end to end
- Layer A: break a repo (missing build script), watch the endpoint move `PENDING` to `DONE`.
- Layer B OOM: run with a tiny memory override and confirm `TASK_OOM`.
- Layer B timeout: set `BUILD_DEADLINE_MINUTES=1`, run a long build, confirm `TIMEOUT`.
- Start failure: confirm the `failures` check marks the deployment failed.
- After timeout tests, check the ECS console and stop any task left running to avoid charges.

## 13. Deliverables checklist

- [ ] Contract change and tests (`user_id` nullable, new optional fields)
- [ ] Prisma migration for new `Deployment` fields
- [ ] `GET /deployments/:id/diagnosis` with all states from section 6
- [ ] `ai-service` scaffold, consumer, stub pipeline, DLQ handling
- [ ] `ai-service/scripts/publish-test-message.ts`
- [ ] `POST /deploy`: tag, `failures` check, save `ecsTaskArn`, Layer A publish
- [ ] SQS poller, event mapper, watchdog
- [ ] Event fixtures and tests
- [ ] Config module with startup validation
- [ ] `docs/ai-diagnosis/AWS-SETUP.md` (names, region, settings; no secrets)
- [ ] `docs/ai-diagnosis/PHASE1-DONE.md` with run instructions
- [ ] Minimal frontend polling hook (optional)

## 14. Definition of done

- Every endpoint state in section 6 verified with a real request
- A hand-published message, a Layer A failure and a Layer B failure each produce exactly one `DONE` diagnosis row
- Duplicate and out-of-order events create no duplicate rows and no crashes
- OOM and timeout cases are diagnosed with the correct `failure_reason`
- A `RunTask` that returns `failures` marks the deployment failed instead of leaving it queued
- Killing and restarting `ai-service` mid-run loses no messages
- Existing build, log streaming and hosting behavior is unchanged
- Reproduction steps documented

## 15. Working agreement for contributors (human or AI)

- Read the existing code first; match each service's patterns and existing status values.
- Never create, modify or delete AWS resources, and never run mutating AWS CLI commands. AWS setup is manual (section 3).
- No placeholders in the wiring; stubs only in the six pipeline steps.
- No new dependencies without discussion.
- One step at a time; show test output before moving on.
- List assumptions explicitly instead of presenting them as verified.
- Do not rename or refactor unrelated code.

## 16. Decision log

| Decision | Choice | Reason |
|----------|--------|--------|
| Build order | Contract fix, endpoint, service, Layer A, Layer B | Each step demoable; AWS-dependent work last |
| Event delivery | SQS poller, kept even when hosted publicly | Outbound only, durable during restarts, no inbound endpoint |
| Timeout | Watchdog with `timedOut` DB flag | ECS has no native timeout; flag is more reliable than stop-reason text |
| Rule filter | `RUNNING` and `STOPPED` | `RUNNING` sets `startedAt` so the deadline excludes provisioning time |
| Task mapping | Saved `ecsTaskArn` primary, task tag secondary | ARN lookup is exact; tag helps debugging |
| `RunTask` failures | Treated as a failed deployment | Prevents deployments stuck in `QUEUED` |
| Stub first | Required | Proves wiring before spending on LLM calls |
| Authentication | None in v1; `user_id` nullable | Deferred; avoids fake ids |
| AWS provisioning | Manual in console, documented in `AWS-SETUP.md` | Matches how existing resources were created |
| Layer B event for an already-diagnosed deployment | Drop, log at debug | Diagnosis exists; avoids duplicates |
| Idempotency | `deploymentId @unique` plus pre-checks | Events are at-least-once |

## 17. Open items

- What per-day diagnosis cap is reasonable once real LLM costs are known (Phase 2)?
- If the API server moves to a scale-to-zero platform, replace the in-process poller with a small function between SQS and the service.

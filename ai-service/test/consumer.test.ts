import { describe, it, expect, vi } from "vitest";
import { processMessage, DlqMessage } from "../src/consumer.js";
import { DiagnosisStore } from "../src/store/diagnosis.js";

describe("Kafka Consumer Message Processing", () => {
  function createMockStore(initialState?: { isAlreadyDone?: boolean }) {
    const records = new Map<string, any>();
    const calls: { upsert: string[]; markDone: any[]; markFailed: any[] } = {
      upsert: [],
      markDone: [],
      markFailed: [],
    };

    const store: DiagnosisStore = {
      async upsertPending(deploymentId: string) {
        calls.upsert.push(deploymentId);
        if (initialState?.isAlreadyDone) {
          return { id: "diag-1", status: "DONE", isAlreadyDone: true };
        }
        records.set(deploymentId, { id: "diag-1", status: "PENDING" });
        return { id: "diag-1", status: "PENDING", isAlreadyDone: false };
      },
      async markDone(deploymentId: string, result: any) {
        calls.markDone.push({ deploymentId, result });
        records.set(deploymentId, { id: "diag-1", status: "DONE", ...result });
      },
      async markFailed(deploymentId: string, errorReason: string) {
        calls.markFailed.push({ deploymentId, errorReason });
        records.set(deploymentId, { id: "diag-1", status: "FAILED", errorReason });
      },
      async findByDeploymentId(deploymentId: string) {
        return records.get(deploymentId) || null;
      },
    };

    return { store, calls, records };
  }

  const validRequest = {
    deployment_id: "dep-consumer-1",
    project_id: "proj-1",
    user_id: null,
    git_url: "https://github.com/example/repo",
    failed_step: "build",
    exit_code: 1,
    failure_reason: "NONZERO_EXIT",
    context_s3_key: "__meta/dep-consumer-1/build-context.json",
    failed_at: "2026-10-10T12:00:00Z",
  };

  it("successfully processes a valid message and writes a DONE row", async () => {
    const { store, calls } = createMockStore();
    const dlqMessages: DlqMessage[] = [];
    const publishDlq = async (msg: DlqMessage) => { dlqMessages.push(msg); };

    const result = await processMessage(
      JSON.stringify(validRequest),
      store,
      publishDlq
    );

    expect(result.status).toBe("done");
    expect(calls.upsert).toContain("dep-consumer-1");
    expect(calls.markDone.length).toBe(1);
    expect(calls.markDone[0].result.source).toBe("STUB");
    expect(calls.markDone[0].result.category).toBe("UNKNOWN");
    expect(dlqMessages.length).toBe(0);
  });

  it("is idempotent: skips pipeline when deployment is already DONE", async () => {
    const { store, calls } = createMockStore({ isAlreadyDone: true });
    const dlqMessages: DlqMessage[] = [];
    const publishDlq = async (msg: DlqMessage) => { dlqMessages.push(msg); };

    const result = await processMessage(
      JSON.stringify(validRequest),
      store,
      publishDlq
    );

    expect(result.status).toBe("skipped");
    expect(calls.markDone.length).toBe(0);
    expect(dlqMessages.length).toBe(0);
  });

  it("routes malformed JSON to DLQ and does not crash", async () => {
    const { store, calls } = createMockStore();
    const dlqMessages: DlqMessage[] = [];
    const publishDlq = async (msg: DlqMessage) => { dlqMessages.push(msg); };

    const result = await processMessage(
      "not-valid-json{{{",
      store,
      publishDlq
    );

    expect(result.status).toBe("dlq");
    expect(dlqMessages.length).toBe(1);
    expect(dlqMessages[0].error).toContain("Invalid JSON");
    expect(calls.upsert.length).toBe(0);
  });

  it("routes contract validation violations to DLQ", async () => {
    const { store, calls } = createMockStore();
    const dlqMessages: DlqMessage[] = [];
    const publishDlq = async (msg: DlqMessage) => { dlqMessages.push(msg); };

    const invalidContractMessage = {
      ...validRequest,
      failed_step: "invalid_step_name", // Not in BuildStep enum
    };

    const result = await processMessage(
      JSON.stringify(invalidContractMessage),
      store,
      publishDlq
    );

    expect(result.status).toBe("dlq");
    expect(dlqMessages.length).toBe(1);
    expect(dlqMessages[0].error).toContain("failed_step");
    expect(calls.upsert.length).toBe(0);
  });

  it("retries pipeline on failure up to 3 times, then marks FAILED and routes to DLQ", async () => {
    const { store, calls } = createMockStore();
    const dlqMessages: DlqMessage[] = [];
    const publishDlq = async (msg: DlqMessage) => { dlqMessages.push(msg); };

    let attempts = 0;
    const failingPipeline = async () => {
      attempts++;
      throw new Error(`Transient error #${attempts}`);
    };

    const result = await processMessage(
      JSON.stringify(validRequest),
      store,
      publishDlq,
      failingPipeline
    );

    expect(result.status).toBe("failed");
    expect(attempts).toBe(3);
    expect(calls.markFailed.length).toBe(1);
    expect(calls.markFailed[0].errorReason).toContain("Transient error #3");
    expect(dlqMessages.length).toBe(1);
    expect(dlqMessages[0].error).toContain("Transient error #3");
  });
});

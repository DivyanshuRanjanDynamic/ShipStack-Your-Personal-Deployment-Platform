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
    expect(calls.markDone.length).toBe(1);
    expect(["LLM", "RULES", "LLM_FALLBACK", "STUB"]).toContain(calls.markDone[0].result.source);
    expect(calls.markDone[0].result.confidence).toBeGreaterThanOrEqual(0);
    expect(dlqMessages.length).toBe(0);
  }, 15000);

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

  it("persists all Phase 2 fields to markDone", async () => {
    const { store, calls } = createMockStore();
    const publishDlq = async () => {};

    const mockPipeline = async () => ({
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.95,
      rootCause: "npm peer dependency conflict",
      fixJson: {
        fix_steps: [{ step: "Run npm install --legacy-peer-deps", type: "config" as const }],
        evidence: [{ line: 12, text: "ERESOLVE unable to resolve dependency tree" }],
        sources: ["rules"],
        needs_human: false,
      },
      source: "RULES" as const,
      signatureHash: "sig-hash-123",
      model: null,
      tokensIn: null,
      tokensOut: null,
      latencyMs: null,
      promptVersion: "2.0.0",
      pipelineVersion: "2.0.0",
    });

    const result = await processMessage(
      JSON.stringify(validRequest),
      store,
      publishDlq,
      mockPipeline
    );

    expect(result.status).toBe("done");
    expect(calls.markDone.length).toBe(1);
    const saved = calls.markDone[0].result;
    expect(saved.signatureHash).toBe("sig-hash-123");
    expect(saved.promptVersion).toBe("2.0.0");
    expect(saved.pipelineVersion).toBe("2.0.0");
    expect(saved.needsHuman).toBe(false);
  });

  it("enforces daily cap by returning safe UNKNOWN diagnosis without calling pipeline", async () => {
    const { store, calls } = createMockStore();
    const publishDlq = async () => {};
    let pipelineCalled = false;
    const mockPipeline = async () => {
      pipelineCalled = true;
      throw new Error("Should not be called when daily cap exceeded");
    };

    const customCfg: any = {
      MAX_DIAGNOSES_PER_DAY: 0, // Force limit to be exceeded immediately
    };

    const result = await processMessage(
      JSON.stringify(validRequest),
      store,
      publishDlq,
      mockPipeline,
      customCfg
    );

    expect(result.status).toBe("done");
    expect(pipelineCalled).toBe(false);
    expect(calls.markDone.length).toBe(1);
    expect(calls.markDone[0].result.category).toBe("UNKNOWN");
    expect(calls.markDone[0].result.confidence).toBe(0);
    expect(calls.markDone[0].result.rootCause).toContain("Daily AI diagnosis limit reached");
    expect(calls.markDone[0].result.needsHuman).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { runPipeline } from "../src/pipeline/index.js";
import { DiagnosisRequest } from "../contracts/diagnosis-request.js";
import { LlmOutput } from "../contracts/llm-output.js";

describe("Stub Diagnosis Pipeline", () => {
  const sampleRequest: DiagnosisRequest = {
    deployment_id: "dep-test-123",
    project_id: "proj-456",
    user_id: null,
    git_url: "https://github.com/org/repo",
    failed_step: "build",
    exit_code: 1,
    failure_reason: "NONZERO_EXIT",
    context_s3_key: "__meta/dep-test-123/build-context.json",
    failed_at: "2026-10-10T12:00:00Z",
  };

  it("runs the full diagnosis pipeline and produces a schema-valid diagnosis", async () => {
    const result = await runPipeline(sampleRequest);

    expect(["LLM", "RULES", "LLM_FALLBACK", "STUB"]).toContain(result.source);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    if (result.category !== "UNKNOWN") {
      expect(result.fixJson.fix_steps.length).toBeGreaterThan(0);
      expect(result.fixJson.evidence.length).toBeGreaterThan(0);
      expect(result.fixJson.needs_human).toBe(false);
    } else {
      expect(result.fixJson.needs_human).toBe(true);
    }

    expect(typeof result.rootCause).toBe("string");
    expect(result.rootCause.length).toBeGreaterThan(0);
  });
});

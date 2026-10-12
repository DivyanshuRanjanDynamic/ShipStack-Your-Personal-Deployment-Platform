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

  it("runs all 6 stub steps and produces a schema-valid STUB diagnosis", async () => {
    const result = await runPipeline(sampleRequest);

    expect(result.source).toBe("STUB");
    expect(result.category).toBe("UNKNOWN");
    expect(result.confidence).toBe(0.5);
    expect(result.rootCause).toContain("stub diagnosis");
    expect(result.fixJson.fix_steps.length).toBeGreaterThan(0);
    expect(result.fixJson.evidence.length).toBeGreaterThan(0);

    // Verify it conforms to LlmOutput schema
    const llmShape = {
      category: result.category,
      confidence: result.confidence,
      root_cause: result.rootCause,
      fix_steps: result.fixJson.fix_steps,
      evidence: result.fixJson.evidence,
      sources: result.fixJson.sources,
      needs_human: result.fixJson.needs_human,
    };
    expect(() => LlmOutput.parse(llmShape)).not.toThrow();
  });
});

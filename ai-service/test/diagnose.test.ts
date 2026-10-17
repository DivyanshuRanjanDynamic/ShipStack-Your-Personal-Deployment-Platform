import { describe, it, expect, vi } from "vitest";
import { diagnose } from "../src/pipeline/diagnose.js";
import type { LlmClient, LlmResponse } from "../src/llm/client.js";
import type { RulesResult } from "../src/pipeline/types.js";

describe("Diagnose Step with Mocked LLM Client (Phase 2, §5.5)", () => {
  const dummyRulesResult: RulesResult = {
    matches: [],
    bestMatch: null,
    shortCircuited: false,
    signature: {
      signatureHash: "sig_abc12345",
      preprocess: {
        lines: [
          { n: 1, text: "[install] npm error code ERESOLVE", step: "install" },
          { n: 2, text: "[install] Could not resolve dependency: react", step: "install" },
        ],
        cleanedLogs: [
          "[install] npm error code ERESOLVE",
          "[install] Could not resolve dependency: react",
        ],
        truncated: false,
        contextMissing: false,
        stats: {
          originalLineCount: 2,
          afterDedup: 2,
          afterWindowing: 2,
          redactionsApplied: 0,
          estimatedTokens: 20,
          longLinesTruncated: 0,
          progressBarsCollapsed: 0,
        },
        buildContext: { framework: "vite" },
        request: {
          deployment_id: "dep-diag-test",
          project_id: "proj-1",
          failed_step: "install",
          exit_code: 1,
          failure_reason: "NONZERO_EXIT",
          git_url: "https://github.com/org/repo",
        },
      },
    },
  };

  it("handles valid LLM response and returns source: LLM", async () => {
    const mockClient: LlmClient = {
      complete: vi.fn().mockResolvedValue({
        content: {
          category: "DEPENDENCY_CONFLICT",
          confidence: 0.95,
          root_cause: "Peer dependency conflict in package tree",
          fix_steps: [{ step: "Run npm install --legacy-peer-deps", type: "config" }],
          evidence: [{ line: 1, text: "code ERESOLVE" }],
          sources: [],
          needs_human: false,
        },
        model: "llama-3.3-70b-versatile",
        tokensIn: 300,
        tokensOut: 80,
        latencyMs: 400,
      }),
    };

    const result = await diagnose(dummyRulesResult, { client: mockClient });

    expect(result.source).toBe("LLM");
    expect(result.category).toBe("DEPENDENCY_CONFLICT");
    expect(result.confidence).toBe(0.95);
    expect(result.tokensIn).toBe(300);
    expect(result.tokensOut).toBe(80);
    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(mockClient.complete).toHaveBeenCalledTimes(1);
  });

  it("retries on initial invalid JSON and succeeds if second attempt is valid", async () => {
    const mockClient: LlmClient = {
      complete: vi
        .fn()
        // First call: invalid evidence line 999
        .mockResolvedValueOnce({
          content: {
            category: "DEPENDENCY_CONFLICT",
            confidence: 0.95,
            root_cause: "Peer dependency conflict",
            fix_steps: [{ step: "Run npm install --legacy-peer-deps", type: "config" }],
            evidence: [{ line: 999, text: "hallucinated" }],
            sources: [],
            needs_human: false,
          },
          model: "llama-3.3-70b-versatile",
          tokensIn: 300,
          tokensOut: 80,
          latencyMs: 350,
        })
        // Second call (retry): valid evidence line 1
        .mockResolvedValueOnce({
          content: {
            category: "DEPENDENCY_CONFLICT",
            confidence: 0.92,
            root_cause: "Peer dependency conflict (corrected)",
            fix_steps: [{ step: "Run npm install --legacy-peer-deps", type: "config" }],
            evidence: [{ line: 1, text: "code ERESOLVE" }],
            sources: [],
            needs_human: false,
          },
          model: "llama-3.3-70b-versatile",
          tokensIn: 450,
          tokensOut: 85,
          latencyMs: 320,
        }),
    };

    const result = await diagnose(dummyRulesResult, { client: mockClient });

    expect(mockClient.complete).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("LLM");
    expect(result.category).toBe("DEPENDENCY_CONFLICT");
    expect(result.tokensIn).toBe(750); // 300 + 450
  });

  it("falls back to LLM_FALLBACK when retry also fails", async () => {
    const mockClient: LlmClient = {
      complete: vi.fn().mockResolvedValue({
        content: {
          category: "INVALID_UNKNOWN_CAT",
          confidence: 0.5,
          root_cause: "bad output",
          fix_steps: [],
          evidence: [],
          sources: [],
          needs_human: true,
        },
        model: "llama-3.3-70b-versatile",
        tokensIn: 200,
        tokensOut: 50,
        latencyMs: 250,
      }),
    };

    const result = await diagnose(dummyRulesResult, { client: mockClient });

    expect(mockClient.complete).toHaveBeenCalledTimes(2);
    expect(result.source).toBe("LLM_FALLBACK");
    expect(result.category).toBe("UNKNOWN");
    expect(result.fixJson.needs_human).toBe(true);
  });

  it("falls back gracefully to UNKNOWN if client throws timeout", async () => {
    const mockClient: LlmClient = {
      complete: vi.fn().mockRejectedValue(new Error("Timeout of 30000ms exceeded")),
    };

    const result = await diagnose(dummyRulesResult, { client: mockClient });

    expect(result.source).toBe("LLM_FALLBACK");
    expect(result.category).toBe("UNKNOWN");
    expect(result.fixJson.needs_human).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { normalizeErrorLine, computeSha256, computeSignature } from "../src/pipeline/signature.js";
import type { PreprocessResult } from "../src/pipeline/types.js";

describe("Signature Step (Phase 2, §5.3)", () => {
  it("normalizes timestamps so different timestamps yield identical normalized strings", () => {
    const line1 = "npm error 2026-10-09T15:28:42.891Z code ERESOLVE";
    const line2 = "npm error 2026-10-12T08:14:10.123Z code ERESOLVE";

    expect(normalizeErrorLine(line1)).toBe(normalizeErrorLine(line2));
    expect(computeSha256(normalizeErrorLine(line1))).toBe(computeSha256(normalizeErrorLine(line2)));
  });

  it("normalizes absolute filesystem paths across different build directories", () => {
    const line1 = "file: /home/app/output/src/components/AnimatedList.tsx:2:0";
    const line2 = "file: /var/lib/docker/workspace_xyz/src/components/AnimatedList.tsx:2:0";

    expect(normalizeErrorLine(line1)).toBe(normalizeErrorLine(line2));
  });

  it("normalizes hex hashes and commit SHAs", () => {
    const line1 = "Error building bundle 7f8b9a12c4d5e6f7: failed to resolve";
    const line2 = "Error building bundle 1a2b3c4d5e6f7a8b: failed to resolve";

    expect(normalizeErrorLine(line1)).toBe(normalizeErrorLine(line2));
  });

  it("produces a valid 64-character SHA-256 hash", () => {
    const hash = computeSha256("normalized error line");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("computes signature from PreprocessResult error line", () => {
    const mockPreprocess: PreprocessResult = {
      lines: [
        { n: 1, text: "[install] starting install", step: "install" },
        { n: 2, text: "[install] npm error code ERESOLVE", step: "install" },
        { n: 3, text: "[install] npm error ERESOLVE could not resolve", step: "install" },
      ],
      cleanedLogs: [
        "[install] starting install",
        "[install] npm error code ERESOLVE",
        "[install] npm error ERESOLVE could not resolve",
      ],
      truncated: false,
      contextMissing: false,
      stats: {
        originalLineCount: 3,
        afterDedup: 3,
        afterWindowing: 3,
        redactionsApplied: 0,
        estimatedTokens: 20,
        longLinesTruncated: 0,
        progressBarsCollapsed: 0,
      },
      buildContext: null,
      request: {
        deployment_id: "dep-sig-1",
        project_id: "proj-1",
        failed_step: "install",
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/org/repo",
      },
    };

    const result = computeSignature(mockPreprocess);
    expect(result.signatureHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.preprocess).toBe(mockPreprocess);
  });
});

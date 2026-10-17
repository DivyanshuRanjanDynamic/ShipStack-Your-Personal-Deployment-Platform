import { describe, it, expect } from "vitest";
import { validateLlmOutput } from "../src/pipeline/validate-output.js";
import type { PreprocessedLine } from "../src/pipeline/types.js";

describe("Semantic Output Validation (Phase 2, §5.5)", () => {
  const sampleLines: PreprocessedLine[] = [
    { n: 1, text: "[install] starting install", step: "install" },
    { n: 2, text: "[install] npm error code ERESOLVE", step: "install" },
    { n: 3, text: "[install] npm error Could not resolve dependency: react-router", step: "install" },
    { n: 4, text: "[install] process exited with code 1", step: "install" },
  ];

  it("passes valid schema and evidence", () => {
    const raw = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.95,
      root_cause: "Peer dependency conflict with react-router",
      fix_steps: [{ step: "Run npm install --legacy-peer-deps", type: "config" }],
      evidence: [{ line: 2, text: "npm error code ERESOLVE" }],
      sources: [],
      needs_human: false,
    };

    const result = validateLlmOutput(raw, { lines: sampleLines });
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.data.category).toBe("DEPENDENCY_CONFLICT");
      expect(result.data.confidence).toBe(0.95);
    }
  });

  it("rejects category not in closed taxonomy", () => {
    const raw = {
      category: "INVALID_RANDOM_CATEGORY",
      confidence: 0.9,
      root_cause: "Some cause",
      fix_steps: [{ step: "Some fix", type: "config" }],
      evidence: [],
      sources: [],
      needs_human: false,
    };

    const result = validateLlmOutput(raw, { lines: sampleLines });
    expect(result.isValid).toBe(false);
  });

  it("rejects empty fix_steps for known categories", () => {
    const raw = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.9,
      root_cause: "Some cause",
      fix_steps: [],
      evidence: [],
      sources: [],
      needs_human: false,
    };

    const result = validateLlmOutput(raw, { lines: sampleLines });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors.some((e) => e.includes("fix_steps"))).toBe(true);
    }
  });

  it("rejects non-existent cited line numbers", () => {
    const raw = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.9,
      root_cause: "Some cause",
      fix_steps: [{ step: "Fix it", type: "config" }],
      evidence: [{ line: 999, text: "npm error code ERESOLVE" }],
      sources: [],
      needs_human: false,
    };

    const result = validateLlmOutput(raw, { lines: sampleLines });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors.some((e) => e.includes("non-existent line number 999"))).toBe(true);
    }
  });

  it("rejects fabricated text on a valid line number", () => {
    const raw = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.9,
      root_cause: "Some cause",
      fix_steps: [{ step: "Fix it", type: "config" }],
      evidence: [{ line: 2, text: "Completely fabricated hallucination" }],
      sources: [],
      needs_human: false,
    };

    const result = validateLlmOutput(raw, { lines: sampleLines });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errors.some((e) => e.includes("does not match"))).toBe(true);
    }
  });

  it("caps confidence when contextMissing or truncated", () => {
    const raw = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.95,
      root_cause: "Some cause",
      fix_steps: [{ step: "Fix it", type: "config" }],
      evidence: [{ line: 2, text: "code ERESOLVE" }],
      sources: [],
      needs_human: false,
    };

    const resContextMissing = validateLlmOutput(raw, { lines: sampleLines, contextMissing: true });
    expect(resContextMissing.isValid).toBe(true);
    if (resContextMissing.isValid) {
      expect(resContextMissing.data.confidence).toBeLessThanOrEqual(0.7);
    }

    const resTruncated = validateLlmOutput(raw, { lines: sampleLines, truncated: true });
    expect(resTruncated.isValid).toBe(true);
    if (resTruncated.isValid) {
      expect(resTruncated.data.confidence).toBeLessThanOrEqual(0.85);
    }
  });
});

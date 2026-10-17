import { describe, it } from "node:test";
import assert from "node:assert";
import { computeMetrics, scoreRootCause, validateEvidence, type CaseEvalResult } from "../metrics.js";
import { estimateCostUsd } from "../config.js";
import type { ExpectedCase } from "../expected-schema.js";

describe("Eval Metrics & Scoring", () => {
  const dummyExpected: ExpectedCase = {
    id: "TEST-01",
    category: "DEPENDENCY_CONFLICT",
    secondary_categories: [],
    root_cause_must_mention: ["peer", "conflict"],
    fix_must_mention: ["legacy-peer-deps"],
    difficulty: "easy",
    framework: "vite",
    package_manager: "npm",
  };

  it("scores root-cause 2 when both root cause and fix match", () => {
    const predicted = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.95,
      root_cause: "Found peer dependency conflict in package tree",
      fix_steps: [{ step: "Run npm install --legacy-peer-deps" }],
      evidence: [],
      source: "RULES",
      isValidJson: true,
      retried: false,
      escalated: false,
      fallback: false,
    };

    const score = scoreRootCause(predicted, dummyExpected);
    assert.strictEqual(score, 2);
  });

  it("scores root-cause 1 when only root cause matches", () => {
    const predicted = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.95,
      root_cause: "Found peer dependency conflict in package tree",
      fix_steps: [{ step: "Upgrade node" }],
      evidence: [],
      source: "RULES",
      isValidJson: true,
      retried: false,
      escalated: false,
      fallback: false,
    };

    const score = scoreRootCause(predicted, dummyExpected);
    assert.strictEqual(score, 1);
  });

  it("scores root-cause 0 when neither matches", () => {
    const predicted = {
      category: "DEPENDENCY_CONFLICT",
      confidence: 0.95,
      root_cause: "Syntax error on line 12",
      fix_steps: [{ step: "Fix semicolon" }],
      evidence: [],
      source: "RULES",
      isValidJson: true,
      retried: false,
      escalated: false,
      fallback: false,
    };

    const score = scoreRootCause(predicted, dummyExpected);
    assert.strictEqual(score, 0);
  });

  it("validates evidence citations accurately against log lines", () => {
    const rawLogs = "Line 1: starting build\nLine 2: npm ERR! peer conflict with react@18\nLine 3: finished";
    const evidence = [
      { line: 2, text: "peer conflict with react@18" }, // valid
      { line: 2, text: "not in this line" }, // invalid text
      { line: 99, text: "out of bounds" }, // invalid line
    ];

    const result = validateEvidence(evidence, rawLogs);
    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.valid, 1);
  });

  it("computes cost correctly using pricing config", () => {
    // llama-3.3-70b-versatile: 0.59 / 1M in, 0.79 / 1M out
    const cost = estimateCostUsd("llama-3.3-70b-versatile", 1000, 500);
    // 0.00059 + 0.000395 = 0.000985
    assert.ok(cost > 0.0009 && cost < 0.0011);
  });

  it("computes aggregate metrics across synthetic results", () => {
    const synthetic: CaseEvalResult[] = [
      {
        caseId: "CASE-1",
        expected: dummyExpected,
        predicted: {
          category: "DEPENDENCY_CONFLICT",
          confidence: 0.9,
          root_cause: "peer conflict",
          fix_steps: [{ step: "use --legacy-peer-deps" }],
          evidence: [{ line: 1, text: "peer conflict" }],
          source: "RULES",
          isValidJson: true,
          retried: false,
          escalated: false,
          fallback: false,
        },
        rawLogs: "peer conflict line",
        latencyMs: 100,
        tokensIn: 500,
        tokensOut: 100,
        model: "llama-3.3-70b-versatile",
        costUsd: 0.001,
      },
      {
        caseId: "CASE-2",
        expected: dummyExpected,
        predicted: {
          category: "UNKNOWN",
          confidence: 0,
          root_cause: "Unknown failure",
          fix_steps: [],
          evidence: [],
          source: "STUB",
          isValidJson: true,
          retried: false,
          escalated: false,
          fallback: false,
        },
        rawLogs: "peer conflict line",
        latencyMs: 200,
        tokensIn: 0,
        tokensOut: 0,
        model: "none",
        costUsd: 0,
      },
    ];

    const metrics = computeMetrics(synthetic);
    assert.strictEqual(metrics.totalCases, 2);
    assert.strictEqual(metrics.overallAccuracy, 0.5);
    assert.strictEqual(metrics.jsonValidityRate, 1);
    assert.strictEqual(metrics.evidenceValidity.totalEvidenceCited, 1);
    assert.strictEqual(metrics.evidenceValidity.validEvidenceCount, 1);
    assert.strictEqual(metrics.latency.p50Ms, 150);
  });
});

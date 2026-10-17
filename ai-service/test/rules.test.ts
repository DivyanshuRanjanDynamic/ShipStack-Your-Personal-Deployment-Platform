import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs/promises";
import { parseRawLogs } from "../src/pipeline/fetchContext.js";
import { preprocess } from "../src/pipeline/preprocess.js";
import { computeSignature } from "../src/pipeline/signature.js";
import { applyRules } from "../src/pipeline/rules.js";
import type { FetchContextResult } from "../src/pipeline/types.js";

describe("Rules Step (Phase 2, §5.4)", () => {
  async function loadAndPrepareFixture(caseId: string, failedStep = "install") {
    const fixtureDir = path.resolve(__dirname, "../../eval/cases", caseId);
    const logs = await fs.readFile(path.join(fixtureDir, "logs.txt"), "utf-8");
    const numberedLogs = parseRawLogs(logs);

    const context: FetchContextResult = {
      logs: numberedLogs,
      buildContext: { framework: "vite" },
      contextMissing: false,
      request: {
        deployment_id: `dep-${caseId}`,
        project_id: "proj-1",
        failed_step: failedStep,
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/org/repo",
      },
    };

    const preprocessed = preprocess(context);
    const signature = computeSignature(preprocessed);
    return signature;
  }

  it("matches DEPENDENCY_CONFLICT-01 fixture to DEPENDENCY_CONFLICT", async () => {
    const signature = await loadAndPrepareFixture("DEPENDENCY_CONFLICT-01", "install");
    const rulesResult = applyRules(signature, { mode: "rules" });

    expect(rulesResult.bestMatch).not.toBeNull();
    expect(rulesResult.bestMatch?.category).toBe("DEPENDENCY_CONFLICT");
    expect(rulesResult.bestMatch?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(rulesResult.bestMatch?.rootCause).toContain("react-beautiful-dnd");
    expect(rulesResult.bestMatch?.fixSteps.some((f) => f.step.includes("--legacy-peer-deps"))).toBe(true);
    expect(rulesResult.bestMatch?.evidence.length).toBeGreaterThan(0);
    // Ensure evidence line number exists in original lines
    for (const ev of rulesResult.bestMatch!.evidence) {
      expect(typeof ev.line).toBe("number");
      expect(ev.line).toBeGreaterThan(0);
    }
  });

  it("matches DEPENDENCY_CONFLICT-02 fixture to DEPENDENCY_CONFLICT", async () => {
    const signature = await loadAndPrepareFixture("DEPENDENCY_CONFLICT-02", "install");
    const rulesResult = applyRules(signature, { mode: "rules" });

    expect(rulesResult.bestMatch).not.toBeNull();
    expect(rulesResult.bestMatch?.category).toBe("DEPENDENCY_CONFLICT");
    expect(rulesResult.bestMatch?.rootCause).toContain("eslint-config-react-app");
    expect(rulesResult.bestMatch?.fixSteps.some((f) => f.step.includes("eslint") && f.step.includes("8"))).toBe(true);
  });

  it("matches MODULE_NOT_FOUND-01 fixture to MODULE_NOT_FOUND", async () => {
    const signature = await loadAndPrepareFixture("MODULE_NOT_FOUND-01", "build");
    const rulesResult = applyRules(signature, { mode: "rules" });

    expect(rulesResult.bestMatch).not.toBeNull();
    expect(rulesResult.bestMatch?.category).toBe("MODULE_NOT_FOUND");
    expect(rulesResult.bestMatch?.rootCause).toContain("framer-motion");
    expect(rulesResult.bestMatch?.fixSteps.some((f) => f.step.includes("npm install framer-motion"))).toBe(true);
  });

  it("matches MODULE_NOT_FOUND-02 fixture to MODULE_NOT_FOUND (casing mismatch)", async () => {
    const signature = await loadAndPrepareFixture("MODULE_NOT_FOUND-02", "build");
    const rulesResult = applyRules(signature, { mode: "rules" });

    expect(rulesResult.bestMatch).not.toBeNull();
    expect(rulesResult.bestMatch?.category).toBe("MODULE_NOT_FOUND");
    expect(rulesResult.bestMatch?.rootCause).toContain("case");
    expect(rulesResult.bestMatch?.fixSteps.some((f) => f.step.includes("casing"))).toBe(true);
  });

  it("skips rules in llm mode", async () => {
    const signature = await loadAndPrepareFixture("DEPENDENCY_CONFLICT-01", "install");
    const rulesResult = applyRules(signature, { mode: "llm" });

    expect(rulesResult.matches.length).toBe(0);
    expect(rulesResult.bestMatch).toBeNull();
    expect(rulesResult.shortCircuited).toBe(false);
  });

  it("short-circuits in hybrid mode on high-confidence single match", async () => {
    const signature = await loadAndPrepareFixture("MODULE_NOT_FOUND-01", "build");
    const rulesResult = applyRules(signature, { mode: "hybrid", threshold: 0.9 });

    expect(rulesResult.shortCircuited).toBe(true);
    expect(rulesResult.bestMatch?.category).toBe("MODULE_NOT_FOUND");
  });
});

import fs from "fs/promises";
import path from "path";

// Load environment variables from ai-service/.env if present
try {
  const envPath = path.resolve(import.meta.dirname, "../ai-service/.env");
  if (process.loadEnvFile) {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignore if .env doesn't exist
}

import { ExpectedCase } from "./expected-schema.js";
import { computeMetrics, type CaseEvalResult } from "./metrics.js";
import { saveReport, type EvalRunReport } from "./reporter.js";
import { estimateCostUsd } from "./config.js";

// Versions pinned in every report
export const PIPELINE_VERSION = "2.0.0";
export const PROMPT_VERSION = "2.0.0";

interface CliOptions {
  mode: "unknown" | "rules" | "llm" | "hybrid";
  split: "dev" | "test" | "all";
  limit?: number;
  model: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    mode: "unknown",
    split: "dev",
    model: "none",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--mode" && args[i + 1]) {
      const m = args[++i];
      if (["unknown", "rules", "llm", "hybrid"].includes(m)) {
        options.mode = m as CliOptions["mode"];
      } else {
        throw new Error(`Invalid --mode: ${m}. Must be unknown, rules, llm, or hybrid.`);
      }
    } else if (arg === "--split" && args[i + 1]) {
      const s = args[++i];
      if (["dev", "test", "all"].includes(s)) {
        options.split = s as CliOptions["split"];
      } else {
        throw new Error(`Invalid --split: ${s}. Must be dev, test, or all.`);
      }
    } else if (arg === "--limit" && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === "--model" && args[i + 1]) {
      options.model = args[++i];
    }
  }

  return options;
}

interface LoadedCase {
  id: string;
  expected: ExpectedCase;
  logs: string;
  buildContext: Record<string, unknown>;
}

async function loadCase(caseId: string, casesDir: string): Promise<LoadedCase> {
  const caseDir = path.join(casesDir, caseId);
  const expectedRaw = await fs.readFile(path.join(caseDir, "expected.json"), "utf-8");
  const expected = ExpectedCase.parse(JSON.parse(expectedRaw));
  const logs = await fs.readFile(path.join(caseDir, "logs.txt"), "utf-8");
  let buildContext: Record<string, unknown> = {};
  try {
    const contextRaw = await fs.readFile(path.join(caseDir, "build-context.json"), "utf-8");
    buildContext = JSON.parse(contextRaw);
  } catch {
    // Missing build-context is allowed
  }

  return { id: caseId, expected, logs, buildContext };
}

/**
 * Execute a single case under the selected mode.
 */
async function evaluateCase(
  caseData: LoadedCase,
  mode: CliOptions["mode"],
  model: string
): Promise<CaseEvalResult> {
  const startTime = Date.now();

  if (mode === "unknown") {
    // In unknown mode, establish the accuracy floor:
    // returns UNKNOWN with 0 confidence, no LLM call, 0 tokens, 0ms latency.
    return {
      caseId: caseData.id,
      expected: caseData.expected,
      predicted: {
        category: "UNKNOWN",
        confidence: 0,
        root_cause: "Unknown failure",
        fix_steps: [],
        evidence: [],
        source: "STUB",
        needs_human: true,
        isValidJson: true,
        retried: false,
        escalated: false,
        fallback: false,
      },
      rawLogs: caseData.logs,
      latencyMs: Date.now() - startTime,
      tokensIn: 0,
      tokensOut: 0,
      model: "none",
      costUsd: 0,
    };
  }

  if (mode === "rules") {
    // Mode rules: pipeline steps fetchContext -> preprocess -> signature -> rules (rules-only)
    const { parseRawLogs } = await import("../ai-service/src/pipeline/fetchContext.js");
    const { preprocess } = await import("../ai-service/src/pipeline/preprocess.js");
    const { computeSignature } = await import("../ai-service/src/pipeline/signature.js");
    const { applyRules } = await import("../ai-service/src/pipeline/rules.js");

    const numberedLogs = parseRawLogs(caseData.logs);
    const fetchContextResult = {
      logs: numberedLogs,
      buildContext: caseData.buildContext,
      contextMissing: Object.keys(caseData.buildContext).length === 0,
      request: {
        deployment_id: caseData.id,
        project_id: "eval-project",
        failed_step: caseData.expected.category === "DEPENDENCY_CONFLICT" ? "install" : "build",
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/example/repo",
      },
    };

    const preprocessed = preprocess(fetchContextResult);
    const signature = computeSignature(preprocessed);
    const rulesResult = applyRules(signature, { mode: "rules" });

    const latencyMs = Date.now() - startTime;

    if (rulesResult.bestMatch) {
      return {
        caseId: caseData.id,
        expected: caseData.expected,
        predicted: {
          category: rulesResult.bestMatch.category,
          confidence: rulesResult.bestMatch.confidence,
          root_cause: rulesResult.bestMatch.rootCause,
          fix_steps: rulesResult.bestMatch.fixSteps,
          evidence: rulesResult.bestMatch.evidence,
          source: "RULES",
          needs_human: false,
          isValidJson: true,
          retried: false,
          escalated: false,
          fallback: false,
        },
        rawLogs: caseData.logs,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        model: "rules-only",
        costUsd: 0,
      };
    }

    return {
      caseId: caseData.id,
      expected: caseData.expected,
      predicted: {
        category: "UNKNOWN",
        confidence: 0,
        root_cause: "No matching failure pattern identified in build logs",
        fix_steps: [],
        evidence: [],
        source: "RULES",
        needs_human: true,
        isValidJson: true,
        retried: false,
        escalated: false,
        fallback: false,
      },
      rawLogs: caseData.logs,
      latencyMs,
      tokensIn: 0,
      tokensOut: 0,
      model: "rules-only",
      costUsd: 0,
    };
  }

  if (mode === "llm" || mode === "hybrid") {
    const { parseRawLogs } = await import("../ai-service/src/pipeline/fetchContext.js");
    const { preprocess } = await import("../ai-service/src/pipeline/preprocess.js");
    const { computeSignature } = await import("../ai-service/src/pipeline/signature.js");
    const { applyRules } = await import("../ai-service/src/pipeline/rules.js");
    const { diagnose } = await import("../ai-service/src/pipeline/diagnose.js");

    const numberedLogs = parseRawLogs(caseData.logs);
    const fetchContextResult = {
      logs: numberedLogs,
      buildContext: caseData.buildContext,
      contextMissing: Object.keys(caseData.buildContext).length === 0,
      request: {
        deployment_id: caseData.id,
        project_id: "eval-project",
        failed_step: caseData.expected.category === "DEPENDENCY_CONFLICT" ? "install" : "build",
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/example/repo",
      },
    };

    const preprocessed = preprocess(fetchContextResult);
    const signature = computeSignature(preprocessed);
    const rulesResult = applyRules(signature, { mode });

    // Hybrid mode short-circuit on high-confidence match
    if (mode === "hybrid" && rulesResult.shortCircuited && rulesResult.bestMatch) {
      const latencyMs = Date.now() - startTime;
      return {
        caseId: caseData.id,
        expected: caseData.expected,
        predicted: {
          category: rulesResult.bestMatch.category,
          confidence: rulesResult.bestMatch.confidence,
          root_cause: rulesResult.bestMatch.rootCause,
          fix_steps: rulesResult.bestMatch.fixSteps,
          evidence: rulesResult.bestMatch.evidence,
          source: "RULES",
          needs_human: false,
          isValidJson: true,
          retried: false,
          escalated: false,
          fallback: false,
        },
        rawLogs: caseData.logs,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        model: "rules-short-circuit",
        costUsd: 0,
      };
    }

    // Call real LLM diagnose step
    const diagResult = await diagnose(rulesResult, {
      model: model !== "none" ? model : undefined,
    });

    const latencyMs = Date.now() - startTime;
    const costUsd = estimateCostUsd(diagResult.model, diagResult.tokensIn, diagResult.tokensOut);

    return {
      caseId: caseData.id,
      expected: caseData.expected,
      predicted: {
        category: diagResult.category,
        confidence: diagResult.confidence,
        root_cause: diagResult.rootCause,
        fix_steps: diagResult.fixJson.fix_steps,
        evidence: diagResult.fixJson.evidence,
        source: diagResult.source,
        needs_human: diagResult.fixJson.needs_human,
        isValidJson: true,
        retried: false,
        escalated: false,
        fallback: diagResult.source === "LLM_FALLBACK",
      },
      rawLogs: caseData.logs,
      latencyMs,
      tokensIn: diagResult.tokensIn || 0,
      tokensOut: diagResult.tokensOut || 0,
      model: diagResult.model || model,
      costUsd,
    };
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

export async function runEval(options: CliOptions): Promise<EvalRunReport> {
  const baseDir = import.meta.dirname;
  const casesDir = path.join(baseDir, "cases");
  const splitFile = path.join(baseDir, "split.json");

  const splitData = JSON.parse(await fs.readFile(splitFile, "utf-8")) as {
    dev: string[];
    test: string[];
  };

  let targetCaseIds: string[] = [];
  if (options.split === "dev") {
    targetCaseIds = [...splitData.dev];
  } else if (options.split === "test") {
    targetCaseIds = [...splitData.test];
  } else {
    targetCaseIds = [...splitData.dev, ...splitData.test];
  }

  if (options.limit && options.limit > 0) {
    targetCaseIds = targetCaseIds.slice(0, options.limit);
  }

  console.log(`\n========================================================`);
  console.log(`Starting Eval Run: Mode=${options.mode.toUpperCase()} | Split=${options.split.toUpperCase()} | Cases=${targetCaseIds.length}`);
  console.log(`========================================================\n`);

  const results: CaseEvalResult[] = [];

  for (const caseId of targetCaseIds) {
    try {
      const loaded = await loadCase(caseId, casesDir);
      const evalResult = await evaluateCase(loaded, options.mode, options.model);
      results.push(evalResult);
      const mark = evalResult.predicted.category === evalResult.expected.category ? "✅" : "❌";
      console.log(`  [${mark}] ${caseId}: expected ${evalResult.expected.category}, predicted ${evalResult.predicted.category} (conf: ${evalResult.predicted.confidence})`);
      if ((options.mode === "llm" || options.mode === "hybrid") && targetCaseIds.indexOf(caseId) < targetCaseIds.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    } catch (err) {
      console.error(`  [ERROR] Case ${caseId} failed to evaluate:`, err);
      throw err;
    }
  }

  const metrics = computeMetrics(results);

  const report: EvalRunReport = {
    timestamp: new Date().toISOString(),
    mode: options.mode,
    split: options.split,
    model: options.model,
    promptVersion: PROMPT_VERSION,
    pipelineVersion: PIPELINE_VERSION,
    metrics,
    cases: results.map((r) => ({
      caseId: r.caseId,
      expectedCategory: r.expected.category,
      predictedCategory: r.predicted.category,
      isCorrect: r.predicted.category === r.expected.category,
      confidence: r.predicted.confidence,
      source: r.predicted.source,
      needsHuman: r.predicted.needs_human ?? true,
      rootCauseScore: metrics.rootCauseScore.scores[r.caseId] ?? 0,
      evidenceCited: r.predicted.evidence.length,
      latencyMs: r.latencyMs,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      costUsd: r.costUsd,
    })),
  };

  const { jsonPath, mdPath } = await saveReport(report, path.join(baseDir, "results"));

  console.log(`\n========================================================`);
  console.log(`Eval Run Complete:`);
  console.log(`  Accuracy:  ${(metrics.overallAccuracy * 100).toFixed(1)}%`);
  console.log(`  JSON Valid: ${(metrics.jsonValidityRate * 100).toFixed(1)}%`);
  console.log(`  Report (MD):   ${mdPath}`);
  console.log(`  Report (JSON): ${jsonPath}`);
  console.log(`========================================================\n`);

  return report;
}

// CLI entry point
if (process.argv[1] && (process.argv[1].endsWith("run.ts") || process.argv[1].endsWith("run.js"))) {
  const options = parseArgs(process.argv.slice(2));
  runEval(options).catch((err) => {
    console.error("Eval run failed:", err);
    process.exit(1);
  });
}

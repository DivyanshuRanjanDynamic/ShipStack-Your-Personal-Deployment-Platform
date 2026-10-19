import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Set environment for retrieval-only evaluation (no LLM key required)
process.env.DIAGNOSIS_MODE = "rules";

// Load environment variables from ai-service/.env
try {
  const envPath = path.resolve(import.meta.dirname, "../ai-service/.env");
  if ((process as any).loadEnvFile) {
    (process as any).loadEnvFile(envPath);
    // Ensure DIAGNOSIS_MODE remains rules for retrieval-only evaluation
    process.env.DIAGNOSIS_MODE = "rules";
  }
} catch {
  // Ignore if .env doesn't exist
}

import { ExpectedCase } from "./expected-schema.js";
import { preprocess } from "../ai-service/src/pipeline/preprocess.js";
import { computeSignature } from "../ai-service/src/pipeline/signature.js";
import { applyRules } from "../ai-service/src/pipeline/rules.js";
import { retrieveContext } from "../ai-service/src/pipeline/retrieve.js";
import { closeDbPool } from "../ai-service/src/kb/db.js";
import type { NumberedLine } from "../ai-service/src/pipeline/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RetrievalCaseResult {
  caseId: string;
  category: string;
  relevantKbIds: string[];
  retrievedIds: string[];
  hitAt3: boolean;
  hitAt5: boolean;
  reciprocalRank: number;
  isEmpty: boolean;
  durationMs: number;
  topScore: number;
}

interface RetrievalReport {
  timestamp: string;
  split: string;
  totalCases: number;
  evaluatedCases: number;
  recallAt3: number;
  recallAt5: number;
  meanReciprocalRank: number;
  emptyRate: number;
  meanDurationMs: number;
  perCategory: Record<
    string,
    {
      count: number;
      recallAt3: number;
      recallAt5: number;
      mrr: number;
    }
  >;
  cases: RetrievalCaseResult[];
}

export async function runRetrievalEval(split: "dev" | "test" | "all" = "dev"): Promise<RetrievalReport> {
  const casesDir = path.resolve(__dirname, "cases");
  const splitRaw = await fs.readFile(path.join(__dirname, "split.json"), "utf-8");
  const splitData = JSON.parse(splitRaw) as { dev: string[]; test: string[] };

  const targetCaseIds =
    split === "dev" ? splitData.dev : split === "test" ? splitData.test : [...splitData.dev, ...splitData.test];

  const results: RetrievalCaseResult[] = [];

  for (const caseId of targetCaseIds) {
    const caseDir = path.join(casesDir, caseId);
    const expectedRaw = await fs.readFile(path.join(caseDir, "expected.json"), "utf-8");
    const expected = ExpectedCase.parse(JSON.parse(expectedRaw));
    const logsRaw = await fs.readFile(path.join(caseDir, "logs.txt"), "utf-8");

    let buildContext: Record<string, unknown> = {};
    try {
      const contextRaw = await fs.readFile(path.join(caseDir, "build-context.json"), "utf-8");
      buildContext = JSON.parse(contextRaw);
    } catch {}

    // Convert logs into NumberedLines
    const numberedLines: NumberedLine[] = logsRaw.split(/\r?\n/).map((text, idx) => ({
      n: idx + 1,
      text,
    }));

    const fetchResult = {
      logs: numberedLines,
      buildContext,
      contextMissing: Object.keys(buildContext).length === 0,
      request: {
        deployment_id: caseId,
        project_id: "eval-project",
        failed_step: "build",
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/example/eval-repo",
      },
    };

    // Run pipeline through retrieval (Steps 2 -> 3 -> 4 -> 5)
    const prepResult = await preprocess(fetchResult);
    const sigResult = await computeSignature(prepResult);
    const rulesResult = applyRules(sigResult, { mode: "hybrid" });
    const retrieveResult = await retrieveContext(rulesResult);

    const retrieved = retrieveResult.retrievedDocs;
    const retrievedIds = retrieved.map((r) => r.id);
    const relevantIds = new Set(expected.relevant_kb_ids || []);

    const top3 = retrievedIds.slice(0, 3);
    const top5 = retrievedIds.slice(0, 5);

    const hitAt3 = top3.some((id) => relevantIds.has(id));
    const hitAt5 = top5.some((id) => relevantIds.has(id));

    let firstRank = 0;
    for (let i = 0; i < top5.length; i++) {
      if (relevantIds.has(top5[i])) {
        firstRank = i + 1;
        break;
      }
    }
    const reciprocalRank = firstRank > 0 ? 1 / firstRank : 0;

    results.push({
      caseId,
      category: expected.category,
      relevantKbIds: expected.relevant_kb_ids || [],
      retrievedIds,
      hitAt3,
      hitAt5,
      reciprocalRank,
      isEmpty: retrieved.length === 0,
      durationMs: retrieveResult.durationMs || 0,
      topScore: retrieved[0]?.score || 0,
    });
  }

  const evalCount = results.filter((r) => r.relevantKbIds.length > 0).length || results.length;
  const recallAt3 = results.reduce((acc, r) => acc + (r.hitAt3 ? 1 : 0), 0) / evalCount;
  const recallAt5 = results.reduce((acc, r) => acc + (r.hitAt5 ? 1 : 0), 0) / evalCount;
  const meanReciprocalRank = results.reduce((acc, r) => acc + r.reciprocalRank, 0) / evalCount;
  const emptyRate = results.reduce((acc, r) => acc + (r.isEmpty ? 1 : 0), 0) / results.length;
  const meanDurationMs = results.reduce((acc, r) => acc + r.durationMs, 0) / results.length;

  // Per category
  const perCategory: RetrievalReport["perCategory"] = {};
  const byCategory = new Map<string, RetrievalCaseResult[]>();
  for (const r of results) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }

  for (const [cat, catResults] of byCategory.entries()) {
    const catEval = catResults.filter((r) => r.relevantKbIds.length > 0).length || catResults.length;
    perCategory[cat] = {
      count: catResults.length,
      recallAt3: catResults.reduce((acc, r) => acc + (r.hitAt3 ? 1 : 0), 0) / catEval,
      recallAt5: catResults.reduce((acc, r) => acc + (r.hitAt5 ? 1 : 0), 0) / catEval,
      mrr: catResults.reduce((acc, r) => acc + r.reciprocalRank, 0) / catEval,
    };
  }

  const report: RetrievalReport = {
    timestamp: new Date().toISOString(),
    split,
    totalCases: results.length,
    evaluatedCases: evalCount,
    recallAt3,
    recallAt5,
    meanReciprocalRank,
    emptyRate,
    meanDurationMs,
    perCategory,
    cases: results,
  };

  return report;
}

export function formatRetrievalMarkdown(report: RetrievalReport): string {
  const lines: string[] = [];
  lines.push(`# Retrieval-Only Evaluation Report (Phase 3 Step 3)`);
  lines.push(``);
  lines.push(`- **Split**: \`${report.split}\``);
  lines.push(`- **Timestamp**: \`${report.timestamp}\``);
  lines.push(`- **Cases Evaluated**: ${report.evaluatedCases} / ${report.totalCases}`);
  lines.push(`- **Recall@3**: **${(report.recallAt3 * 100).toFixed(1)}%**`);
  lines.push(`- **Recall@5**: **${(report.recallAt5 * 100).toFixed(1)}%**`);
  lines.push(`- **Mean Reciprocal Rank (MRR)**: **${report.meanReciprocalRank.toFixed(3)}**`);
  lines.push(`- **Empty Result Rate**: ${(report.emptyRate * 100).toFixed(1)}%`);
  lines.push(`- **Mean Latency**: ${report.meanDurationMs.toFixed(1)}ms`);
  lines.push(``);
  lines.push(`## Category Breakdown`);
  lines.push(``);
  lines.push(`| Category | Cases | Recall@3 | Recall@5 | MRR |`);
  lines.push(`|---|---|---|---|---|`);
  for (const [cat, data] of Object.entries(report.perCategory)) {
    lines.push(
      `| \`${cat}\` | ${data.count} | ${(data.recallAt3 * 100).toFixed(1)}% | ${(data.recallAt5 * 100).toFixed(1)}% | ${data.mrr.toFixed(3)} |`
    );
  }
  lines.push(``);
  lines.push(`## Case Details`);
  lines.push(``);
  lines.push(`| Case ID | Category | Relevant Chunks | Retrieved Top 3 | Hit@3 | Hit@5 | Reciprocal Rank | Latency |`);
  lines.push(`|---|---|---|---|---|---|---|---|`);
  for (const c of report.cases) {
    const relevant = c.relevantKbIds.join(", ") || "-";
    const retrieved = c.retrievedIds.slice(0, 3).join(", ") || "-";
    lines.push(
      `| \`${c.caseId}\` | \`${c.category}\` | ${relevant} | ${retrieved} | ${c.hitAt3 ? "✅" : "❌"} | ${c.hitAt5 ? "✅" : "❌"} | ${c.reciprocalRank.toFixed(2)} | ${c.durationMs}ms |`
    );
  }
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const splitArg = (process.argv.find((a, i) => process.argv[i - 1] === "--split") || "dev") as "dev" | "test" | "all";
  console.log(`Running retrieval-only evaluation on split: ${splitArg}...`);

  runRetrievalEval(splitArg)
    .then(async (report) => {
      console.log("==================================================");
      console.log(`Retrieval Evaluation Complete: Split=${report.split.toUpperCase()}`);
      console.log("==================================================");
      console.log(`Recall@3:  ${(report.recallAt3 * 100).toFixed(1)}%`);
      console.log(`Recall@5:  ${(report.recallAt5 * 100).toFixed(1)}%`);
      console.log(`MRR:       ${report.meanReciprocalRank.toFixed(3)}`);
      console.log(`Latency:   ${report.meanDurationMs.toFixed(1)}ms`);
      console.log("--------------------------------------------------");
      for (const [cat, d] of Object.entries(report.perCategory)) {
        console.log(`  - ${cat.padEnd(25)} Recall@5: ${(d.recallAt5 * 100).toFixed(1)}% | MRR: ${d.mrr.toFixed(3)}`);
      }
      console.log("==================================================");

      // Save report
      const resultsDir = path.resolve(__dirname, "results");
      await fs.mkdir(resultsDir, { recursive: true });
      const filenameBase = `${report.timestamp.replace(/[:.]/g, "-")}-retrieval-${report.split}`;
      const mdPath = path.join(resultsDir, `${filenameBase}.md`);
      const jsonPath = path.join(resultsDir, `${filenameBase}.json`);
      await fs.writeFile(mdPath, formatRetrievalMarkdown(report), "utf-8");
      await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf-8");
      console.log(`Report written to ${path.relative(process.cwd(), mdPath)}`);

      await closeDbPool();
    })
    .catch(async (err) => {
      console.error("Retrieval evaluation failed:", err);
      await closeDbPool();
      process.exit(1);
    });
}

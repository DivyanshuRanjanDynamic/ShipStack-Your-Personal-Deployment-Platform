import fs from "fs/promises";
import path from "path";
import type { CaseEvalResult, MetricSummary } from "./metrics.js";

export interface EvalRunReport {
  timestamp: string;
  mode: "unknown" | "rules" | "llm" | "hybrid";
  split: "dev" | "test" | "all";
  model: string;
  promptVersion: string;
  pipelineVersion: string;
  metrics: MetricSummary;
  cases: Array<{
    caseId: string;
    expectedCategory: string;
    predictedCategory: string;
    isCorrect: boolean;
    confidence: number;
    source: string;
    needsHuman: boolean;
    rootCauseScore: number;
    evidenceCited: number;
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }>;
}

export function generateMarkdownReport(report: EvalRunReport): string {
  const { mode, split, timestamp, model, promptVersion, pipelineVersion, metrics, cases } = report;

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const usd = (n: number) => `$${n.toFixed(6)}`;

  let md = `# Diagnosis Evaluation Report: ${mode.toUpperCase()} Mode\n\n`;
  md += `> Run at: **${timestamp}** | Split: **${split}** | Mode: **${mode}**\n\n`;

  md += `## Configuration\n\n`;
  md += `| Parameter | Value |\n`;
  md += `|-----------|-------|\n`;
  md += `| **Mode** | \`${mode}\` |\n`;
  md += `| **Split** | \`${split}\` |\n`;
  md += `| **Model** | \`${model}\` |\n`;
  md += `| **Prompt Version** | \`${promptVersion}\` |\n`;
  md += `| **Pipeline Version** | \`${pipelineVersion}\` |\n`;
  md += `| **Total Cases** | ${metrics.totalCases} |\n\n`;

  md += `## Executive Summary\n\n`;
  md += `| Metric | Result | Target / Floor |\n`;
  md += `|--------|--------|----------------|\n`;
  md += `| **Overall Category Accuracy** | **${pct(metrics.overallAccuracy)}** (${cases.filter(c => c.isCorrect).length}/${metrics.totalCases}) | Floor: 0% |\n`;
  md += `| **Root-Cause Score (0-2 avg)** | **${metrics.rootCauseScore.averageScore.toFixed(2)}** / 2.00 | Full: ${metrics.rootCauseScore.fullMatchCount}, Part: ${metrics.rootCauseScore.partialMatchCount}, None: ${metrics.rootCauseScore.noMatchCount} |\n`;
  md += `| **Evidence Validity Rate** | **${pct(metrics.evidenceValidity.validityRate)}** | ${metrics.evidenceValidity.validEvidenceCount}/${metrics.evidenceValidity.totalEvidenceCited} valid citations |\n`;
  if (metrics.citations) {
    md += `| **Grounded-Step Rate** | **${pct(metrics.citations.groundedStepRate)}** | ${metrics.citations.groundedStepsCount}/${metrics.citations.totalFixSteps} steps cited KB |\n`;
    md += `| **Citation Validity Rate** | **${pct(metrics.citations.citationValidityRate)}** | ${metrics.citations.validCitations}/${metrics.citations.totalCitations} citations valid |\n`;
  }
  md += `| **JSON Validity Rate** | **${pct(metrics.jsonValidityRate)}** | Target: 100% |\n`;
  md += `| **Retry Rate** | ${pct(metrics.retryRate)} | Target: < 5% |\n`;
  md += `| **Fallback Rate** | ${pct(metrics.fallbackRate)} | Target: < 5% |\n`;
  md += `| **Escalation Rate** | ${pct(metrics.escalationRate)} | -- |\n`;
  md += `| **Latency (p50 / p95 / mean)** | **${metrics.latency.p50Ms}ms** / **${metrics.latency.p95Ms}ms** / ${metrics.latency.meanMs}ms | -- |\n`;
  md += `| **Tokens In / Out (mean)** | ${metrics.tokens.meanIn} / ${metrics.tokens.meanOut} | Total: ${metrics.tokens.totalIn} in, ${metrics.tokens.totalOut} out |\n`;
  md += `| **Estimated Cost (total / mean)** | **${usd(metrics.cost.totalUsd)}** / **${usd(metrics.cost.meanUsd)}** | Price table in \`eval/config.ts\` |\n\n`;

  md += `## Category Accuracy Breakdown\n\n`;
  md += `| Category | Total | Correct | Accuracy |\n`;
  md += `|----------|-------|---------|----------|\n`;
  for (const [cat, data] of Object.entries(metrics.categoryAccuracy)) {
    md += `| \`${cat}\` | ${data.total} | ${data.correct} | **${pct(data.accuracy)}** |\n`;
  }
  md += `\n`;

  md += `## Difficulty Accuracy Breakdown\n\n`;
  md += `| Difficulty | Total | Correct | Accuracy |\n`;
  md += `|------------|-------|---------|----------|\n`;
  for (const [diff, data] of Object.entries(metrics.difficultyAccuracy)) {
    md += `| \`${diff}\` | ${data.total} | ${data.correct} | **${pct(data.accuracy)}** |\n`;
  }
  md += `\n`;

  md += `## Confusion Matrix (Expected Rows × Predicted Columns)\n\n`;
  // Collect all unique predicted categories
  const allPredicted = new Set<string>();
  for (const row of Object.values(metrics.confusionMatrix)) {
    for (const pred of Object.keys(row)) {
      allPredicted.add(pred);
    }
  }
  const predCols = Array.from(allPredicted).sort();

  md += `| Expected \\ Predicted | ${predCols.map((c) => `\`${c}\``).join(" | ")} |\n`;
  md += `| ${"-".repeat(20)} | ${predCols.map(() => "---").join(" | ")} |\n`;
  for (const [exp, row] of Object.entries(metrics.confusionMatrix)) {
    const cells = predCols.map((p) => row[p] || 0);
    md += `| \`${exp}\` | ${cells.join(" | ")} |\n`;
  }
  md += `\n`;

  md += `## Per-Case Results\n\n`;
  md += `| Case ID | Expected | Predicted | Status | Conf | RC Score | Evid | Latency | Cost |\n`;
  md += `|---------|----------|-----------|:------:|------|:--------:|:----:|--------:|-----:|\n`;
  for (const c of cases) {
    const statusIcon = c.isCorrect ? "✅" : "❌";
    md += `| \`${c.caseId}\` | \`${c.expectedCategory}\` | \`${c.predictedCategory}\` | ${statusIcon} | ${c.confidence.toFixed(2)} | ${c.rootCauseScore}/2 | ${c.evidenceCited} | ${c.latencyMs}ms | ${usd(c.costUsd)} |\n`;
  }
  md += `\n`;

  return md;
}

export async function saveReport(
  report: EvalRunReport,
  resultsDir: string = path.join(import.meta.dirname, "results")
): Promise<{ jsonPath: string; mdPath: string }> {
  await fs.mkdir(resultsDir, { recursive: true });

  const safeTimestamp = report.timestamp.replace(/[:.]/g, "-");
  const baseName = `${safeTimestamp}-${report.mode}`;
  const jsonPath = path.join(resultsDir, `${baseName}.json`);
  const mdPath = path.join(resultsDir, `${baseName}.md`);

  const mdContent = generateMarkdownReport(report);
  const jsonContent = JSON.stringify(report, null, 2);

  await fs.writeFile(jsonPath, jsonContent, "utf-8");
  await fs.writeFile(mdPath, mdContent, "utf-8");

  return { jsonPath, mdPath };
}

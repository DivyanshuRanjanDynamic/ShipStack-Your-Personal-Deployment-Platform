import type { ExpectedCase } from "./expected-schema.js";
import { estimateCostUsd } from "./config.js";

export interface CaseEvalResult {
  caseId: string;
  expected: ExpectedCase;
  predicted: {
    category: string;
    confidence: number;
    root_cause: string;
    fix_steps: Array<{ step: string; type?: string; source_chunk_id?: string | null }>;
    evidence: Array<{ line: number; text: string }>;
    sources?: string[];
    retrievedChunkIds?: string[];
    source: string;
    needs_human?: boolean;
    rawOutput?: unknown;
    isValidJson: boolean;
    retried: boolean;
    escalated: boolean;
    fallback: boolean;
  };
  rawLogs: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  model: string;
  costUsd: number;
}

export interface MetricSummary {
  totalCases: number;
  overallAccuracy: number; // 0 to 1
  categoryAccuracy: Record<string, { total: number; correct: number; accuracy: number }>;
  difficultyAccuracy: Record<string, { total: number; correct: number; accuracy: number }>;
  confusionMatrix: Record<string, Record<string, number>>; // expected -> predicted -> count

  rootCauseScore: {
    averageScore: number; // 0 to 2
    fullMatchCount: number; // score 2
    partialMatchCount: number; // score 1
    noMatchCount: number; // score 0
    scores: Record<string, number>; // caseId -> score (0, 1, 2)
  };

  evidenceValidity: {
    totalEvidenceCited: number;
    validEvidenceCount: number;
    validityRate: number; // 0 to 1
  };

  citations: {
    totalFixSteps: number;
    groundedStepsCount: number;
    groundedStepRate: number; // 0 to 1
    totalCitations: number;
    validCitations: number;
    citationValidityRate: number; // 0 to 1
  };

  jsonValidityRate: number; // 0 to 1
  retryRate: number; // 0 to 1
  fallbackRate: number; // 0 to 1
  escalationRate: number; // 0 to 1

  latency: {
    meanMs: number;
    p50Ms: number;
    p95Ms: number;
    minMs: number;
    maxMs: number;
  };

  tokens: {
    totalIn: number;
    totalOut: number;
    meanIn: number;
    meanOut: number;
  };

  cost: {
    totalUsd: number;
    meanUsd: number;
  };
}

/**
 * Checks keyword matches case-insensitively.
 */
function keywordsMatch(text: string, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.every((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Score root-cause & fix accuracy on a 0 / 1 / 2 scale.
 * 2: both root_cause mentions and fix mentions match
 * 1: either root_cause mentions or fix mentions match
 * 0: neither match
 */
export function scoreRootCause(
  predicted: CaseEvalResult["predicted"],
  expected: ExpectedCase
): number {
  const rootMatches = keywordsMatch(
    predicted.root_cause || "",
    expected.root_cause_must_mention
  );

  const fixCombined = (predicted.fix_steps || [])
    .map((s) => s.step)
    .join(" ");
  const fixMatches = keywordsMatch(fixCombined, expected.fix_must_mention);

  if (rootMatches && fixMatches) return 2;
  if (rootMatches || fixMatches) return 1;
  return 0;
}

// M1 audit fix: strip ANSI codes from raw logs before comparison,
// matching the pipeline's preprocessing. Note: redacted text (e.g.
// [REDACTED:aws_key]) may still differ from raw logs if fixtures
// contain real secrets — a known limitation until fixtures use preprocessed text.
const ANSI_REGEX_EVAL = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * Validates evidence citations against raw log lines.
 * An evidence item is valid if:
 * 1. Line number n exists in 1-based log lines
 * 2. The cited text is actually a substring of that line's text (after ANSI stripping + normalization)
 */
export function validateEvidence(
  evidence: Array<{ line: number; text: string }>,
  rawLogs: string
): { total: number; valid: number } {
  if (!evidence || evidence.length === 0) {
    return { total: 0, valid: 0 };
  }

  const logLines = rawLogs.split(/\r?\n/);
  let valid = 0;

  for (const item of evidence) {
    if (typeof item.line !== "number" || item.line < 1 || item.line > logLines.length) {
      continue;
    }
    const actualLine = logLines[item.line - 1] || "";
    // Strip ANSI codes and normalize whitespace to match pipeline preprocessing
    const cleanActual = actualLine.replace(ANSI_REGEX_EVAL, "").replace(/\s+/g, " ").trim().toLowerCase();
    const cleanCited = (item.text || "").replace(ANSI_REGEX_EVAL, "").replace(/\s+/g, " ").trim().toLowerCase();
    if (cleanCited.length > 0 && cleanActual.includes(cleanCited)) {
      valid++;
    }
  }

  return { total: evidence.length, valid };
}

/**
 * Calculates percentile from a sorted array of numbers.
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (p <= 0) return sortedArr[0];
  if (p >= 100) return sortedArr[sortedArr.length - 1];
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArr[lower];
  return Math.round(sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (index - lower));
}

/**
 * Compute all evaluation metrics from a set of case results.
 */
export function computeMetrics(results: CaseEvalResult[]): MetricSummary {
  const total = results.length;
  if (total === 0) {
    return {
      totalCases: 0,
      overallAccuracy: 0,
      categoryAccuracy: {},
      difficultyAccuracy: {},
      confusionMatrix: {},
      rootCauseScore: { averageScore: 0, fullMatchCount: 0, partialMatchCount: 0, noMatchCount: 0, scores: {} },
      evidenceValidity: { totalEvidenceCited: 0, validEvidenceCount: 0, validityRate: 0 },
      citations: {
        totalFixSteps: 0,
        groundedStepsCount: 0,
        groundedStepRate: 0,
        totalCitations: 0,
        validCitations: 0,
        citationValidityRate: 1.0,
      },
      jsonValidityRate: 0,
      retryRate: 0,
      fallbackRate: 0,
      escalationRate: 0,
      latency: { meanMs: 0, p50Ms: 0, p95Ms: 0, minMs: 0, maxMs: 0 },
      tokens: { totalIn: 0, totalOut: 0, meanIn: 0, meanOut: 0 },
      cost: { totalUsd: 0, meanUsd: 0 },
    };
  }

  let correctCount = 0;
  const categoryAcc: Record<string, { total: number; correct: number; accuracy: number }> = {};
  const difficultyAcc: Record<string, { total: number; correct: number; accuracy: number }> = {};
  const confusion: Record<string, Record<string, number>> = {};

  let totalRootScore = 0;
  let fullMatchCount = 0;
  let partialMatchCount = 0;
  let noMatchCount = 0;
  const scoresByCase: Record<string, number> = {};

  let totalEvidenceCited = 0;
  let validEvidenceCount = 0;

  let totalFixStepsCount = 0;
  let groundedStepsCount = 0;
  let totalCitationsCount = 0;
  let validCitationsCount = 0;

  let validJsonCount = 0;
  let retryCount = 0;
  let fallbackCount = 0;
  let escalationCount = 0;

  const latencies: number[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCostUsd = 0;

  for (const r of results) {
    const expCat = r.expected.category;
    const predCat = r.predicted.category;
    const diff = r.expected.difficulty || "unknown";

    // Category accuracy
    const isCorrect = predCat === expCat;
    if (isCorrect) correctCount++;

    if (!categoryAcc[expCat]) categoryAcc[expCat] = { total: 0, correct: 0, accuracy: 0 };
    categoryAcc[expCat].total++;
    if (isCorrect) categoryAcc[expCat].correct++;

    if (!difficultyAcc[diff]) difficultyAcc[diff] = { total: 0, correct: 0, accuracy: 0 };
    difficultyAcc[diff].total++;
    if (isCorrect) difficultyAcc[diff].correct++;

    // Confusion matrix
    if (!confusion[expCat]) confusion[expCat] = {};
    confusion[expCat][predCat] = (confusion[expCat][predCat] || 0) + 1;

    // Root-cause scoring
    const rcScore = scoreRootCause(r.predicted, r.expected);
    scoresByCase[r.caseId] = rcScore;
    totalRootScore += rcScore;
    if (rcScore === 2) fullMatchCount++;
    else if (rcScore === 1) partialMatchCount++;
    else noMatchCount++;

    // Evidence validity
    const ev = validateEvidence(r.predicted.evidence, r.rawLogs);
    totalEvidenceCited += ev.total;
    validEvidenceCount += ev.valid;

    // Citations & grounding (Phase 3)
    const retrievedSet = new Set(r.predicted.retrievedChunkIds || []);
    const steps = (r.predicted.fix_steps as any[]) || [];
    for (const st of steps) {
      totalFixStepsCount++;
      if (st.source_chunk_id) {
        groundedStepsCount++;
        totalCitationsCount++;
        // Citations are only valid if they match a chunk in the retrieved set
        if (
          typeof st.source_chunk_id === "string" &&
          st.source_chunk_id.trim().length > 0 &&
          retrievedSet.has(st.source_chunk_id.trim())
        ) {
          validCitationsCount++;
        }
      }
    }

    // Reliability & routing rates
    if (r.predicted.isValidJson) validJsonCount++;
    if (r.predicted.retried) retryCount++;
    if (r.predicted.fallback) fallbackCount++;
    if (r.predicted.escalated) escalationCount++;

    // Latency & tokens & cost
    latencies.push(r.latencyMs || 0);
    totalTokensIn += r.tokensIn || 0;
    totalTokensOut += r.tokensOut || 0;
    totalCostUsd += r.costUsd || estimateCostUsd(r.model, r.tokensIn, r.tokensOut);
  }

  // Calculate percentage accuracies
  for (const cat of Object.keys(categoryAcc)) {
    categoryAcc[cat].accuracy =
      categoryAcc[cat].total > 0
        ? Math.round((categoryAcc[cat].correct / categoryAcc[cat].total) * 1000) / 1000
        : 0;
  }
  for (const diff of Object.keys(difficultyAcc)) {
    difficultyAcc[diff].accuracy =
      difficultyAcc[diff].total > 0
        ? Math.round((difficultyAcc[diff].correct / difficultyAcc[diff].total) * 1000) / 1000
        : 0;
  }

  latencies.sort((a, b) => a - b);

  return {
    totalCases: total,
    overallAccuracy: Math.round((correctCount / total) * 1000) / 1000,
    categoryAccuracy: categoryAcc,
    difficultyAccuracy: difficultyAcc,
    confusionMatrix: confusion,
    rootCauseScore: {
      averageScore: Math.round((totalRootScore / total) * 100) / 100,
      fullMatchCount,
      partialMatchCount,
      noMatchCount,
      scores: scoresByCase,
    },
    evidenceValidity: {
      totalEvidenceCited,
      validEvidenceCount,
      validityRate:
        totalEvidenceCited > 0
          ? Math.round((validEvidenceCount / totalEvidenceCited) * 1000) / 1000
          : 0,
    },
    citations: {
      totalFixSteps: totalFixStepsCount,
      groundedStepsCount,
      groundedStepRate:
        totalFixStepsCount > 0
          ? Math.round((groundedStepsCount / totalFixStepsCount) * 1000) / 1000
          : 0,
      totalCitations: totalCitationsCount,
      validCitations: validCitationsCount,
      citationValidityRate:
        totalCitationsCount > 0
          ? Math.round((validCitationsCount / totalCitationsCount) * 1000) / 1000
          : 1.0,
    },
    jsonValidityRate: Math.round((validJsonCount / total) * 1000) / 1000,
    retryRate: Math.round((retryCount / total) * 1000) / 1000,
    fallbackRate: Math.round((fallbackCount / total) * 1000) / 1000,
    escalationRate: Math.round((escalationCount / total) * 1000) / 1000,
    latency: {
      meanMs: Math.round(latencies.reduce((a, b) => a + b, 0) / total),
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      minMs: latencies[0] || 0,
      maxMs: latencies[latencies.length - 1] || 0,
    },
    tokens: {
      totalIn: totalTokensIn,
      totalOut: totalTokensOut,
      meanIn: Math.round(totalTokensIn / total),
      meanOut: Math.round(totalTokensOut / total),
    },
    cost: {
      totalUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      meanUsd: Math.round((totalCostUsd / total) * 1_000_000) / 1_000_000,
    },
  };
}

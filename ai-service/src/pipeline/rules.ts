import { config } from "../config.js";
import { logger } from "../logger.js";
import { RULES_TABLE, type RuleDefinition } from "./rules-table.js";
import type { RuleMatch, RulesResult, SignatureResult } from "./types.js";

/**
 * Step 4: Heuristic rules classifier.
 *
 * Implements PHASE2.md §5.4:
 * - Data-driven rule table in rules-table.ts.
 * - Extracts real evidence lines (original `n` numbers).
 * - Mode behavior:
 *   - rules: returns best match or null (UNKNOWN).
 *   - llm: skips rules.
 *   - hybrid: if exactly one category matches with confidence >= RULES_CONFIDENCE_THRESHOLD (0.9),
 *     short-circuits (source: RULES) and skips LLM; otherwise returns matches as hints.
 */
export function applyRules(
  signatureResult: SignatureResult,
  options: { mode?: "rules" | "llm" | "hybrid"; threshold?: number } = {}
): RulesResult {
  const startTime = Date.now();
  const mode = options.mode ?? config.DIAGNOSIS_MODE;
  const threshold = options.threshold ?? config.RULES_CONFIDENCE_THRESHOLD;

  // In llm-only mode, skip rules entirely
  if (mode === "llm") {
    logger.info("applyRules skipped (DIAGNOSIS_MODE is llm)", { mode });
    return {
      matches: [],
      bestMatch: null,
      shortCircuited: false,
      signature: signatureResult,
    };
  }

  const lines = signatureResult.preprocess.lines;
  const failedStep = signatureResult.preprocess.request?.failed_step;
  const fullText = lines.map((l) => l.text).join("\n");

  const matches: RuleMatch[] = [];

  for (const rule of RULES_TABLE) {
    // If rule requires a specific step and we have failedStep, verify
    if (rule.requiresStep && failedStep && !rule.requiresStep.includes(failedStep)) {
      continue;
    }

    const match = fullText.match(rule.pattern);
    if (match) {
      const evidence = rule.extractEvidence(lines, match);
      const rootCause = rule.buildRootCause(lines, match);
      const fixSteps = rule.buildFixSteps(lines, match);

      matches.push({
        ruleId: rule.id,
        category: rule.category,
        confidence: rule.confidence,
        evidence,
        fixSteps,
        rootCause,
      });
    }
  }

  // Sort matches by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);

  const bestMatch = matches.length > 0 ? matches[0] : null;

  // Determine short-circuiting behavior
  let shortCircuited = false;
  if (mode === "rules") {
    // In rules-only mode, always short-circuit with best match (or UNKNOWN if null)
    shortCircuited = true;
  } else if (mode === "hybrid") {
    // In hybrid mode: if exactly one category matches with confidence >= threshold
    const matchingCategories = new Set(
      matches.filter((m) => m.confidence >= threshold).map((m) => m.category)
    );
    if (matchingCategories.size === 1 && bestMatch && bestMatch.confidence >= threshold) {
      shortCircuited = true;
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info("Rules evaluation complete", {
    durationMs,
    mode,
    matchesCount: matches.length,
    shortCircuited,
    bestCategory: bestMatch?.category ?? null,
  });

  return {
    matches,
    bestMatch,
    shortCircuited,
    signature: signatureResult,
  };
}

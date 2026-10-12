import { logger } from "../logger.js";
import { SignatureResult } from "./signature.js";

export interface RulesResult {
  matchedRule: { category: string; rootCause: string } | null;
  signature: SignatureResult;
}

/**
 * Step 4: Fast heuristic rules classifier.
 *
 * [STUB IMPLEMENTATION - PHASE 1]
 * Logs its name, input size, and duration, returning no rule match so it proceeds to LLM.
 */
export async function applyRules(signatureResult: SignatureResult): Promise<RulesResult> {
  const startTime = Date.now();
  const inputSize = signatureResult.preprocess.cleanedLogs.length;

  logger.info("[STUB PIPELINE: 4/6] rules start", {
    step: "rules",
    inputLinesCount: inputSize,
  });

  // Stub returns no fast match
  const matchedRule = null;

  const durationMs = Date.now() - startTime;
  logger.info("[STUB PIPELINE: 4/6] rules complete", {
    step: "rules",
    durationMs,
    matchedRule: null,
  });

  return {
    matchedRule,
    signature: signatureResult,
  };
}

import { logger } from "../logger.js";
import type { RetrieveResult, RulesResult } from "./types.js";

export type { RetrieveResult };

/**
 * Step 5: Hybrid retrieval (RAG) - no-op in Phase 1.
 *
 * [STUB IMPLEMENTATION - PHASE 1]
 * Logs its name, input size, and duration, returning empty retrieval set.
 */
export async function retrieveContext(rulesResult: RulesResult): Promise<RetrieveResult> {
  const startTime = Date.now();

  logger.info("[STUB PIPELINE: 5/6] retrieve start (no-op)", {
    step: "retrieve",
  });

  const durationMs = Date.now() - startTime;
  logger.info("[STUB PIPELINE: 5/6] retrieve complete", {
    step: "retrieve",
    durationMs,
    docsCount: 0,
  });

  return {
    retrievedDocs: [],
    rules: rulesResult,
  };
}

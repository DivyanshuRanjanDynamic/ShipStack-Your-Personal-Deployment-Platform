import { logger } from "../logger.js";
import { FetchContextResult } from "./fetchContext.js";

export interface PreprocessResult {
  cleanedLogs: string[];
  buildContext: Record<string, unknown>;
}

/**
 * Step 2: Clean, redact ANSI codes, and trim logs.
 *
 * [STUB IMPLEMENTATION - PHASE 1]
 * Logs its name, input size, and duration, returning canned cleaned logs.
 */
export async function preprocess(context: FetchContextResult): Promise<PreprocessResult> {
  const startTime = Date.now();
  const inputSize = context.logs.reduce((acc, line) => acc + line.length, 0);

  logger.info("[STUB PIPELINE: 2/6] preprocess start", {
    step: "preprocess",
    inputSizeBytes: inputSize,
    rawLinesCount: context.logs.length,
  });

  // Simulated clean/redact
  const cleanedLogs = context.logs.map((line) => line.trim());

  const durationMs = Date.now() - startTime;
  logger.info("[STUB PIPELINE: 2/6] preprocess complete", {
    step: "preprocess",
    durationMs,
    cleanedLinesCount: cleanedLogs.length,
  });

  return {
    cleanedLogs,
    buildContext: context.buildContext,
  };
}

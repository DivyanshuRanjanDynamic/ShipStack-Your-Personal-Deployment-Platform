import { logger } from "../logger.js";
import { PreprocessResult } from "./preprocess.js";

export interface SignatureResult {
  signatureHash: string;
  cacheHit: boolean;
  preprocess: PreprocessResult;
}

/**
 * Step 3: Compute signature hash and check diagnosis cache.
 *
 * [STUB IMPLEMENTATION - PHASE 1]
 * Logs its name, input size, and duration, returning canned signature hash (no cache hit).
 */
export async function computeSignature(preprocessed: PreprocessResult): Promise<SignatureResult> {
  const startTime = Date.now();
  const inputSize = preprocessed.cleanedLogs.join("\n").length;

  logger.info("[STUB PIPELINE: 3/6] signature start", {
    step: "signature",
    inputSizeBytes: inputSize,
  });

  // Simulated stub hash
  const signatureHash = "stub_signature_hash_0000000000000000000000000000000000000000";

  const durationMs = Date.now() - startTime;
  logger.info("[STUB PIPELINE: 3/6] signature complete", {
    step: "signature",
    durationMs,
    signatureHash,
    cacheHit: false,
  });

  return {
    signatureHash,
    cacheHit: false,
    preprocess: preprocessed,
  };
}

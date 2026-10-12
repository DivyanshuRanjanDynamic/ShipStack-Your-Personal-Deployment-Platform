import { LlmOutput } from "../../contracts/llm-output.js";
import { logger } from "../logger.js";
import { RetrieveResult } from "./retrieve.js";

export interface PipelineDiagnosisResult {
  category: string;
  confidence: number;
  rootCause: string;
  fixJson: {
    fix_steps: Array<{ step: string; type: "config" | "code" | "env" | "none" }>;
    evidence: Array<{ line: number; text: string }>;
    sources: string[];
    needs_human: boolean;
  };
  source: "STUB";
}

/**
 * Step 6: LLM Diagnosis inference.
 *
 * [STUB IMPLEMENTATION - PHASE 1]
 * Logs its name, input size, and duration, returning a valid canned LlmOutput
 * with source: STUB, category: UNKNOWN, root_cause: "stub diagnosis".
 */
export async function diagnose(retrieveResult: RetrieveResult): Promise<PipelineDiagnosisResult> {
  const startTime = Date.now();
  const inputSize = retrieveResult.rules.signature.preprocess.cleanedLogs.length;

  logger.info("[STUB PIPELINE: 6/6] diagnose start", {
    step: "diagnose",
    inputLinesCount: inputSize,
  });

  const cannedOutput: LlmOutput = {
    category: "UNKNOWN",
    confidence: 0.5,
    root_cause: "stub diagnosis: automatic diagnosis placeholder for Phase 1",
    evidence: [
      { line: 1, text: "Build failure observed in step marker" }
    ],
    fix_steps: [
      { step: "Inspect full build logs in dashboard", type: "none" }
    ],
    sources: [],
    needs_human: true,
  };

  // Validate output against LlmOutput contract
  LlmOutput.parse(cannedOutput);

  const durationMs = Date.now() - startTime;
  logger.info("[STUB PIPELINE: 6/6] diagnose complete", {
    step: "diagnose",
    durationMs,
    category: cannedOutput.category,
    source: "STUB",
  });

  return {
    category: cannedOutput.category,
    confidence: cannedOutput.confidence,
    rootCause: cannedOutput.root_cause,
    fixJson: {
      fix_steps: cannedOutput.fix_steps,
      evidence: cannedOutput.evidence,
      sources: cannedOutput.sources,
      needs_human: cannedOutput.needs_human,
    },
    source: "STUB",
  };
}

import { DiagnosisRequest } from "../../contracts/diagnosis-request.js";
import { logger } from "../logger.js";
import { fetchContext } from "./fetchContext.js";
import { preprocess } from "./preprocess.js";
import { computeSignature } from "./signature.js";
import { applyRules } from "./rules.js";
import { retrieveContext } from "./retrieve.js";
import { diagnose } from "./diagnose.js";
import type { PipelineDiagnosisResult } from "./types.js";

/**
 * Executes the six-step diagnosis pipeline sequentially.
 */
export async function runPipeline(request: DiagnosisRequest): Promise<PipelineDiagnosisResult> {
  const overallStart = Date.now();
  logger.info(`Starting diagnosis pipeline for deployment ${request.deployment_id}`, {
    deploymentId: request.deployment_id,
    failedStep: request.failed_step,
    failureReason: request.failure_reason,
  });

  // 1. Fetch logs + build-context
  const context = await fetchContext(request);

  // 2. Preprocess: clean, redact, trim
  const preprocessed = await preprocess(context);

  // 3. Signature & cache lookup
  const signature = await computeSignature(preprocessed);

  // 4. Fast heuristic rules classifier
  const rules = await applyRules(signature);

  // If rules short-circuited (rules-only mode or high-confidence hybrid match), return immediately
  if (rules.shortCircuited) {
    const totalDurationMs = Date.now() - overallStart;
    const finalResult: PipelineDiagnosisResult = rules.bestMatch
      ? {
          category: rules.bestMatch.category,
          confidence: rules.bestMatch.confidence,
          rootCause: rules.bestMatch.rootCause,
          fixJson: {
            fix_steps: rules.bestMatch.fixSteps,
            evidence: rules.bestMatch.evidence,
            sources: ["rules"],
            needs_human: false,
          },
          source: "RULES",
          signatureHash: signature.signatureHash,
          model: null,
          tokensIn: null,
          tokensOut: null,
          latencyMs: null,
          promptVersion: "2.0.0",
          pipelineVersion: "2.0.0",
        }
      : {
          category: "UNKNOWN",
          confidence: 0,
          rootCause: "No matching failure pattern identified in build logs",
          fixJson: {
            fix_steps: [],
            evidence: [],
            sources: ["rules"],
            needs_human: true,
          },
          source: "RULES",
          signatureHash: signature.signatureHash,
          model: null,
          tokensIn: null,
          tokensOut: null,
          latencyMs: null,
          promptVersion: "2.0.0",
          pipelineVersion: "2.0.0",
        };

    logger.info(`Completed diagnosis pipeline (short-circuited by rules) for deployment ${request.deployment_id} in ${totalDurationMs}ms`, {
      deploymentId: request.deployment_id,
      totalDurationMs,
      category: finalResult.category,
      source: finalResult.source,
    });

    return finalResult;
  }

  // 5. Hybrid retrieval (RAG)
  const retrieved = await retrieveContext(rules);

  // 6. LLM Diagnosis call
  const result = await diagnose(retrieved);

  const totalDurationMs = Date.now() - overallStart;
  logger.info(`Completed diagnosis pipeline for deployment ${request.deployment_id} in ${totalDurationMs}ms`, {
    deploymentId: request.deployment_id,
    totalDurationMs,
    category: result.category,
    source: result.source,
  });

  return result;
}

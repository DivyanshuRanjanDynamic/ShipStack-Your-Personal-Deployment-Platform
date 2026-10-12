import { DiagnosisRequest } from "../../contracts/diagnosis-request.js";
import { logger } from "../logger.js";

export interface FetchContextResult {
  logs: string[];
  buildContext: Record<string, unknown>;
}

/**
 * Step 1: Fetch logs (from ClickHouse) and build-context (from S3).
 *
 * [STUB IMPLEMENTATION - PHASE 1]
 * Logs its name, input size, and duration, returning canned context.
 */
export async function fetchContext(request: DiagnosisRequest): Promise<FetchContextResult> {
  const startTime = Date.now();
  const inputSize = JSON.stringify(request).length;

  logger.info("[STUB PIPELINE: 1/6] fetchContext start", {
    step: "fetchContext",
    inputSizeBytes: inputSize,
    deploymentId: request.deployment_id,
  });

  // Simulated canned logs and build context
  const cannedResult: FetchContextResult = {
    logs: [
      "[clone:start]",
      `[clone] Cloning repository ${request.git_url}`,
      "[clone:end] exit_code=0",
      `[${request.failed_step}:start]`,
      `[${request.failed_step}] Failure encountered during ${request.failed_step}`,
      `[${request.failed_step}:end] exit_code=${request.exit_code}`,
    ],
    buildContext: {
      deployment_id: request.deployment_id,
      git_url: request.git_url,
      framework: "vite",
      package_manager: "npm",
    },
  };

  const durationMs = Date.now() - startTime;
  logger.info("[STUB PIPELINE: 1/6] fetchContext complete", {
    step: "fetchContext",
    durationMs,
    logLinesCount: cannedResult.logs.length,
  });

  return cannedResult;
}

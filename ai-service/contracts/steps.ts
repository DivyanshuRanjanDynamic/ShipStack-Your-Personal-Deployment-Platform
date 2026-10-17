import { z } from "zod";

/**
 * Build steps emitted as step markers by build-server.
 * Matches the step field in Kafka log messages.
 */
export const BuildStep = z.enum(["clone", "install", "build", "upload"]);
export type BuildStep = z.infer<typeof BuildStep>;

/**
 * Failure reasons recorded when a build task ends unsuccessfully.
 * Phase 0 defines the enum; detection of TASK_OOM and TIMEOUT
 * via EventBridge is deferred to Phase 1.
 */
export const FailureReason = z.enum([
  "TASK_OOM",
  "TIMEOUT",
  "NONZERO_EXIT",
  "UPLOAD_EMPTY",
  "CLONE_FAILED",
]);
export type FailureReason = z.infer<typeof FailureReason>;

/**
 * Diagnosis status lifecycle.
 */
export const DiagnosisStatus = z.enum(["PENDING", "DONE", "FAILED"]);
export type DiagnosisStatus = z.infer<typeof DiagnosisStatus>;

/**
 * Diagnosis source — how the diagnosis was produced.
 */
export const DiagnosisSource = z.enum(["RULES", "LLM", "LLM_FALLBACK", "CACHE", "STUB"]);
export type DiagnosisSource = z.infer<typeof DiagnosisSource>;

/**
 * Fix step type in an LLM diagnosis output.
 */
export const FixStepType = z.enum(["config", "code", "env", "none"]);
export type FixStepType = z.infer<typeof FixStepType>;

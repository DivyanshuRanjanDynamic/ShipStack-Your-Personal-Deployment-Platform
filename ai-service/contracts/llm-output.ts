import { z } from "zod";
import { CategoryId } from "../taxonomy/schema.js";
import { FixStepType } from "./steps.js";

/**
 * A single piece of evidence from the build logs.
 */
export const Evidence = z.object({
  /** Line number in the log output (1-indexed). */
  line: z.number().int().positive(),
  /** The log line content. */
  text: z.string().min(1),
});
export type Evidence = z.infer<typeof Evidence>;

/**
 * A single fix step recommended by the diagnosis.
 */
export const FixStep = z.object({
  /** Human-readable description of the fix. */
  step: z.string().min(1),
  /** Classification of what kind of change is needed. */
  type: FixStepType,
  /** ID of the retrieved knowledge chunk this step was derived from, or null if from logs alone. */
  source_chunk_id: z.string().nullable().optional(),
});
export type FixStep = z.infer<typeof FixStep>;

/**
 * Schema for the structured LLM diagnosis output.
 * The LLM must return JSON conforming to this schema.
 * If validation fails, the caller retries once.
 *
 * Constraints (from spec §6.2):
 * - category must be in the taxonomy
 * - confidence in [0, 1]
 * - evidence must reference real log line numbers (checked in evaluation)
 */
export const LlmOutput = z.object({
  category: CategoryId,
  confidence: z.number().min(0).max(1),
  root_cause: z.string().min(1),
  evidence: z.array(Evidence).min(1),
  fix_steps: z.array(FixStep).min(1),
  sources: z.array(z.string()),
  needs_human: z.boolean(),
});
export type LlmOutput = z.infer<typeof LlmOutput>;

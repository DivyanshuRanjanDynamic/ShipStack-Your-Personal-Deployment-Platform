import { z } from "zod";
import { BuildStep, FailureReason } from "./steps.js";

/**
 * Schema for the `diagnosis-requests` Kafka message.
 * Published by the API server when a deployment fails.
 * Consumed by the (future) ai-service.
 *
 * Matches spec §6.1.
 */
export const DiagnosisRequest = z.object({
  deployment_id: z.string().min(1),
  project_id: z.string().min(1),
  user_id: z.string().nullable(),
  git_url: z.string().url(),
  failed_step: BuildStep,
  exit_code: z.number().int(),
  failure_reason: FailureReason,
  context_s3_key: z.string().min(1),
  failed_at: z.string().datetime(),
  stop_code: z.string().nullable().optional(),
  stopped_reason: z.string().nullable().optional(),
});
export type DiagnosisRequest = z.infer<typeof DiagnosisRequest>;

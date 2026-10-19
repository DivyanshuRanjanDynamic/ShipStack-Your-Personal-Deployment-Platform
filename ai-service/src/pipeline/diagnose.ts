import { config } from "../config.js";
import { logger } from "../logger.js";
import { GroqClient } from "../llm/groq-client.js";
import type { LlmClient } from "../llm/client.js";
import { buildSystemPrompt, buildUserPrompt, PROMPT_VERSION } from "./prompt.js";
import { validateLlmOutput, type ValidationResult } from "./validate-output.js";
import { retrieveContext } from "./retrieve.js";
import type { PipelineDiagnosisResult, RetrieveResult, RulesResult } from "./types.js";

export const PIPELINE_VERSION = "3.0.0";

export interface DiagnoseOptions {
  client?: LlmClient;
  model?: string;
  skipEscalation?: boolean;
}

/**
 * Step 6: LLM Diagnosis Inference with structured output, validation, retry, fallback, and escalation.
 *
 * Implements PHASE2.md §5.5:
 * - Uses LlmClient (default: GroqClient with JSON mode, temperature 0).
 * - Semantic validation of taxonomy, evidence line existence/text, non-empty fix steps.
 * - Retry: on invalid output, retries once with errors appended.
 * - Fallback: on repeated failure, falls back to rules match or UNKNOWN (source: LLM_FALLBACK).
 * - Escalation: if primary confidence < ESCALATION_CONFIDENCE_THRESHOLD, tries escalation model.
 */
export async function diagnose(
  input: RetrieveResult | RulesResult,
  options: DiagnoseOptions = {}
): Promise<PipelineDiagnosisResult> {
  const overallStart = Date.now();

  const retrieveResult: RetrieveResult =
    "retrievedDocs" in input ? input : await retrieveContext(input);
  const rulesResult = retrieveResult.rules;
  const signature = rulesResult.signature;
  const preprocessed = signature.preprocess;
  const lines = preprocessed.lines;
  const request = preprocessed.request;

  const apiKey = (process.env.LLM_API_KEY || config.LLM_API_KEY || "").replace(/^["']|["']$/g, "").trim();
  const client: LlmClient = options.client || new GroqClient(apiKey);
  const primaryModel = options.model || config.LLM_MODEL_PRIMARY;

  const systemPrompt = buildSystemPrompt();
  const retrievedChunks = retrieveResult.retrievedDocs || [];
  const retrievedChunkIds = new Set(retrievedChunks.map((c) => c.id));
  const chunkMap = new Map(retrievedChunks.map((c) => [c.id, c]));

  const userPrompt = buildUserPrompt({
    failedStep: request.failed_step,
    exitCode: request.exit_code,
    failureReason: request.failure_reason,
    gitUrl: request.git_url,
    buildContext: preprocessed.buildContext,
    ruleHints: rulesResult.matches,
    chunks: retrievedChunks,
    lines,
  });

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let usedModel = primaryModel;
  let retried = false;
  let validationResult: ValidationResult | null = null;

  try {
    // 1. Primary LLM call
    logger.info("Calling primary LLM for diagnosis", {
      deploymentId: request.deployment_id,
      model: primaryModel,
    });

    const resp = await client.complete(messages, {
      model: primaryModel,
      temperature: 0,
      maxTokens: 1024,
      timeoutMs: config.LLM_TIMEOUT_MS,
    });

    totalTokensIn += resp.tokensIn;
    totalTokensOut += resp.tokensOut;
    usedModel = resp.model || primaryModel;

    validationResult = validateLlmOutput(resp.content, {
      lines,
      contextMissing: preprocessed.contextMissing,
      truncated: preprocessed.truncated,
      retrievedChunkIds,
    });

    // 2. Retry if invalid
    if (!validationResult.isValid) {
      retried = true;
      logger.warn("Initial LLM response failed validation, attempting retry", {
        deploymentId: request.deployment_id,
        errors: validationResult.errors,
      });

      const retryMessages = [
        ...messages,
        { role: "assistant" as const, content: JSON.stringify(resp.content) },
        {
          role: "user" as const,
          content: `Your previous response was rejected due to the following validation errors:\n${validationResult.errors.join(
            "\n"
          )}\n\nPlease correct these issues and return a single valid JSON object strictly complying with the schema and evidence rules.`,
        },
      ];

      const retryResp = await client.complete(retryMessages, {
        model: primaryModel,
        temperature: 0,
        maxTokens: 1024,
        timeoutMs: config.LLM_TIMEOUT_MS,
      });

      totalTokensIn += retryResp.tokensIn;
      totalTokensOut += retryResp.tokensOut;

      validationResult = validateLlmOutput(retryResp.content, {
        lines,
        contextMissing: preprocessed.contextMissing,
        truncated: preprocessed.truncated,
        retrievedChunkIds,
      });
    }

    // 3. Check if valid after retry
    if (validationResult.isValid) {
      let finalData = validationResult.data;

      // 4. Escalation path
      if (
        !options.skipEscalation &&
        finalData.confidence < config.ESCALATION_CONFIDENCE_THRESHOLD &&
        config.LLM_MODEL_ESCALATION &&
        config.LLM_MODEL_ESCALATION !== primaryModel
      ) {
        logger.info("Confidence below escalation threshold, invoking escalation model", {
          confidence: finalData.confidence,
          threshold: config.ESCALATION_CONFIDENCE_THRESHOLD,
          escalationModel: config.LLM_MODEL_ESCALATION,
        });

        try {
          const escResp = await client.complete(messages, {
            model: config.LLM_MODEL_ESCALATION,
            temperature: 0,
            maxTokens: 1024,
            timeoutMs: config.LLM_TIMEOUT_MS,
          });

          totalTokensIn += escResp.tokensIn;
          totalTokensOut += escResp.tokensOut;

          const escValidation = validateLlmOutput(escResp.content, {
            lines,
            contextMissing: preprocessed.contextMissing,
            truncated: preprocessed.truncated,
            retrievedChunkIds,
          });

          if (escValidation.isValid && escValidation.data.confidence > finalData.confidence) {
            finalData = escValidation.data;
            usedModel = escResp.model || config.LLM_MODEL_ESCALATION;
          }
        } catch (escErr) {
          logger.warn("Escalation call failed, keeping primary result", { err: escErr });
        }
      }

      const totalLatencyMs = Date.now() - overallStart;

      const sourcesDetailed = (finalData.sources || []).map((id) => {
        const c = chunkMap.get(id);
        return {
          id,
          title: c?.title || id,
          url: c?.sourceUrl || null,
        };
      });

      return {
        category: finalData.category,
        confidence: finalData.confidence,
        rootCause: finalData.root_cause,
        fixJson: {
          fix_steps: finalData.fix_steps,
          evidence: finalData.evidence,
          sources: finalData.sources || [],
          sources_detailed: sourcesDetailed,
          retrieved_chunk_ids: Array.from(retrievedChunkIds),
          needs_human: finalData.needs_human,
        },
        source: "LLM",
        signatureHash: signature.signatureHash,
        model: usedModel,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        latencyMs: totalLatencyMs,
        promptVersion: PROMPT_VERSION,
        pipelineVersion: PIPELINE_VERSION,
      };
    }
  } catch (err) {
    logger.error("LLM diagnosis call failed", {
      deploymentId: request.deployment_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Fallback path: validation repeatedly failed or infrastructure exception occurred
  const totalLatencyMs = Date.now() - overallStart;

  if (rulesResult.bestMatch) {
    logger.info("Falling back to best rule match", {
      category: rulesResult.bestMatch.category,
    });
    return {
      category: rulesResult.bestMatch.category,
      confidence: rulesResult.bestMatch.confidence,
      rootCause: rulesResult.bestMatch.rootCause,
      fixJson: {
        fix_steps: rulesResult.bestMatch.fixSteps,
        evidence: rulesResult.bestMatch.evidence,
        sources: ["rules_fallback"],
        // M2 audit fix: this is a degraded path (LLM failed validation),
        // so flag for human review even though the rule match may be confident
        needs_human: true,
      },
      source: "RULES",
      signatureHash: signature.signatureHash,
      model: usedModel,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      latencyMs: totalLatencyMs,
      promptVersion: PROMPT_VERSION,
      pipelineVersion: PIPELINE_VERSION,
    };
  }

  logger.info("Falling back to UNKNOWN with LLM_FALLBACK source");
  return {
    category: "UNKNOWN",
    confidence: 0,
    rootCause: "Diagnosis engine was unable to determine a confident root cause from the logs.",
    fixJson: {
      fix_steps: [],
      evidence: [],
      sources: ["llm_fallback"],
      needs_human: true,
    },
    source: "LLM_FALLBACK",
    signatureHash: signature.signatureHash,
    model: usedModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    latencyMs: totalLatencyMs,
    promptVersion: PROMPT_VERSION,
    pipelineVersion: PIPELINE_VERSION,
  };
}

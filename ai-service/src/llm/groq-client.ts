/**
 * Groq LLM client implementation.
 *
 * Uses Groq's OpenAI-compatible REST API with JSON mode for structured output.
 * No SDK dependency — raw fetch calls.
 *
 * Security:
 * - API key is read from config, never logged or included in error messages.
 * - Prompt and response bodies are never logged; only ids, sizes, token counts, timings.
 */

import { LlmClient, LlmMessage, LlmCompletionOptions, LlmResponse } from "./client.js";
import { logger } from "../logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqClient implements LlmClient {
  private readonly apiKey: string;

  constructor(apiKeyOrOptions: string | { apiKey: string }) {
    const rawKey = typeof apiKeyOrOptions === "string" ? apiKeyOrOptions : apiKeyOrOptions?.apiKey;
    const cleanKey = (rawKey || "").replace(/^["']|["']$/g, "").trim();
    if (!cleanKey) {
      throw new Error("GroqClient: API key is required");
    }
    this.apiKey = cleanKey;
  }

  async complete(messages: LlmMessage[], options: LlmCompletionOptions): Promise<LlmResponse> {
    const {
      model,
      responseSchema,
      temperature = 0,
      maxTokens = 4096,
      timeoutMs = 30000,
    } = options;

    const requestId = `groq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.info("LLM request start", {
      requestId,
      model,
      messageCount: messages.length,
      inputChars: messages.reduce((sum, m) => sum + m.content.length, 0),
      timeoutMs,
    });

    // Build the request body with JSON mode for structured output.
    // The system prompt must instruct the model to return JSON matching the schema.
    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      // Groq does not support response_format with a schema directly,
      // so we rely on the system prompt to enforce the schema shape.
      // The schema is included in the system prompt by the caller (prompt.ts).
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response | null = null;
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        attempts++;
        response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (response.status === 429 && attempts < maxAttempts) {
          const errorText = await response.text().catch(() => "");
          let delayMs = 3000;
          const match = errorText.match(/try again in ([0-9.]+)s/i);
          if (match && match[1]) {
            delayMs = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
          }
          const retryAfter = response.headers.get("retry-after");
          if (retryAfter) {
            const parsedSec = parseFloat(retryAfter);
            if (!isNaN(parsedSec)) delayMs = Math.max(delayMs, Math.ceil(parsedSec * 1000));
          }
          // H3 audit fix: cap retry delay to prevent unbounded waits from
          // malicious/buggy retry-after headers. Also abort if total elapsed
          // time + delay would exceed the caller's timeout budget.
          const MAX_RETRY_DELAY_MS = 30_000;
          const elapsed = Date.now() - startTime;
          delayMs = Math.min(delayMs, MAX_RETRY_DELAY_MS, Math.max(0, timeoutMs - elapsed));
          if (delayMs <= 0) {
            throw new Error(`LLM request would exceed timeout of ${timeoutMs}ms after retry delay`);
          }
          logger.warn("Groq rate limit hit (429), backing off before retry", {
            requestId,
            delayMs,
          });
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        break;
      }

      if (!response || !response.ok) {
        const errorText = await response?.text().catch(() => "") || "";
        throw new Error(
          `Groq API error: HTTP ${response?.status} ${response?.statusText}: ${errorText}`
        );
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };

      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error("Groq API returned no content in response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        throw new Error(
          `Groq API returned invalid JSON (${rawContent.length} chars)`
        );
      }

      const latencyMs = Date.now() - startTime;
      const tokensIn = data.usage?.prompt_tokens ?? 0;
      const tokensOut = data.usage?.completion_tokens ?? 0;

      logger.info("LLM request complete", {
        requestId,
        model: data.model || model,
        tokensIn,
        tokensOut,
        latencyMs,
        responseChars: rawContent.length,
      });

      return {
        content: parsed,
        model: data.model || model,
        tokensIn,
        tokensOut,
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if it's an abort (timeout)
      if (err instanceof Error && err.name === "AbortError") {
        logger.error("LLM request timed out", err, {
          requestId,
          model,
          latencyMs,
          timeoutMs,
        });
        throw new Error(`LLM request timed out after ${timeoutMs}ms`);
      }

      logger.error("LLM request failed", err, {
        requestId,
        model,
        latencyMs,
      });
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

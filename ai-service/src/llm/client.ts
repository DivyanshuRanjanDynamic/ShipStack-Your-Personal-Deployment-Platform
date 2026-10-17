/**
 * LlmClient interface — abstracts the LLM provider so it is swappable
 * and tests can mock it.
 *
 * The interface deliberately exposes only what the diagnosis pipeline needs:
 * a single structured-output completion call.
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletionOptions {
  /** Model identifier (e.g. "llama-3.3-70b-versatile"). Never hardcoded by callers. */
  model: string;
  /** JSON schema describing the expected output shape (for structured output). Optional; not all providers support it. */
  responseSchema?: Record<string, unknown>;
  /** Temperature (0 for deterministic). */
  temperature?: number;
  /** Maximum output tokens. */
  maxTokens?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

export interface LlmResponse {
  /** Parsed JSON response from the model. */
  content: unknown;
  /** Model that actually served the request. */
  model: string;
  /** Input token count reported by the provider. */
  tokensIn: number;
  /** Output token count reported by the provider. */
  tokensOut: number;
  /** Wall-clock latency of the API call in milliseconds. */
  latencyMs: number;
}

/**
 * Provider-agnostic LLM client.
 * Implementations must:
 * - Never log prompt bodies or response bodies
 * - Log only ids, sizes, hashes, token counts, and timings
 * - Respect the timeout
 * - Return parsed JSON (not raw text)
 */
export interface LlmClient {
  /**
   * Send a structured-output completion request.
   * @throws on timeout, provider error, or unparseable response
   */
  complete(messages: LlmMessage[], options: LlmCompletionOptions): Promise<LlmResponse>;
}

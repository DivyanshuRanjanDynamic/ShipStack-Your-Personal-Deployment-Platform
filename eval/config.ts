/**
 * Eval configuration: pricing tables, default splits, paths.
 * Price table is configurable and separate from metric computation logic.
 */

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/**
 * Token pricing in USD per 1,000,000 tokens.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Groq models
  "openai/gpt-oss-120b": { inputPerMillion: 0.50, outputPerMillion: 0.80 },
  "openai/gpt-oss-20b": { inputPerMillion: 0.15, outputPerMillion: 0.30 },
  "qwen/qwen3.8-27b": { inputPerMillion: 0.20, outputPerMillion: 0.30 },
  "llama-3.3-70b-versatile": { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  "llama-3.1-70b-versatile": { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  "llama-3.1-8b-instant": { inputPerMillion: 0.05, outputPerMillion: 0.08 },
  "mixtral-8x7b-32768": { inputPerMillion: 0.24, outputPerMillion: 0.24 },
  "gemma2-9b-it": { inputPerMillion: 0.20, outputPerMillion: 0.20 },

  // OpenAI models (for reference/comparison)
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  "gpt-4o": { inputPerMillion: 2.50, outputPerMillion: 10.00 },

  // Default fallback
  "default": { inputPerMillion: 0.50, outputPerMillion: 0.80 },
};

/**
 * Calculate cost for a given model and token counts.
 */
export function estimateCostUsd(
  model: string | null | undefined,
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined
): number {
  if (!tokensIn && !tokensOut) return 0;
  const inCount = tokensIn || 0;
  const outCount = tokensOut || 0;

  const pricing = (model && MODEL_PRICING[model]) || MODEL_PRICING["default"];
  const cost =
    (inCount / 1_000_000) * pricing.inputPerMillion +
    (outCount / 1_000_000) * pricing.outputPerMillion;

  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places
}

import { LlmOutput } from "../../contracts/llm-output.js";
import { taxonomyById } from "../../taxonomy/schema.js";
import type { PreprocessedLine } from "./types.js";

export interface SemanticValidationOptions {
  lines: PreprocessedLine[];
  contextMissing?: boolean;
  truncated?: boolean;
}

export interface ValidationSuccess {
  isValid: true;
  data: LlmOutput;
}

export interface ValidationFailure {
  isValid: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validates LLM output using Zod schema and strict semantic checks:
 * 1. Category must exist in the closed taxonomy.
 * 2. Every cited evidence line number must exist in the preprocessed lines.
 * 3. Every cited evidence text must match the text of that line.
 * 4. fix_steps must be non-empty unless category is UNKNOWN.
 * 5. Confidence is capped when contextMissing or truncated.
 */
export function validateLlmOutput(
  rawJson: unknown,
  options: SemanticValidationOptions
): ValidationResult {
  const errors: string[] = [];

  // 1. Zod schema validation
  const zodResult = LlmOutput.safeParse(rawJson);
  if (!zodResult.success) {
    const formattedErrors = zodResult.error.issues.map(
      (i) => `${i.path.join(".") || "root"}: ${i.message}`
    );
    return { isValid: false, errors: formattedErrors };
  }

  const output = zodResult.data;

  // 2. Closed taxonomy check
  if (!taxonomyById.has(output.category)) {
    errors.push(`Category "${output.category}" is not in the closed taxonomy.`);
  }

  // 3. fix_steps non-empty unless UNKNOWN
  if (output.category !== "UNKNOWN" && (!output.fix_steps || output.fix_steps.length === 0)) {
    errors.push(`fix_steps must not be empty for category "${output.category}".`);
  }

  // 4. Evidence citations verification
  const lineMap = new Map<number, string>();
  for (const l of options.lines) {
    lineMap.set(l.n, l.text.toLowerCase());
  }

  if (output.evidence && output.evidence.length > 0) {
    for (let i = 0; i < output.evidence.length; i++) {
      const item = output.evidence[i];
      const actualLineText = lineMap.get(item.line);

      if (actualLineText === undefined) {
        errors.push(
          `Evidence item [${i}] cites non-existent line number ${item.line}. Line does not exist in logs.`
        );
        continue;
      }

      const cleanActual = actualLineText.replace(/\s+/g, " ").trim();
      const cleanCited = item.text.toLowerCase().replace(/\s+/g, " ").trim();

      // Check substring or substantial match
      if (cleanCited.length > 0 && !cleanActual.includes(cleanCited)) {
        errors.push(
          `Evidence item [${i}] text "${item.text.slice(0, 40)}" does not match the actual text on line ${item.line}: "${actualLineText.slice(0, 40)}".`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 5. Semantic adjustments: confidence capping & UNKNOWN needs_human
  let confidence = output.confidence;
  if (options.contextMissing) {
    confidence = Math.min(confidence, 0.7);
  }
  if (options.truncated) {
    confidence = Math.min(confidence, 0.85);
  }

  let needsHuman = output.needs_human;
  if (output.category === "UNKNOWN" || confidence < 0.6) {
    needsHuman = true;
  }

  const validatedData: LlmOutput = {
    ...output,
    confidence: Math.round(confidence * 100) / 100,
    needs_human: needsHuman,
  };

  return { isValid: true, data: validatedData };
}

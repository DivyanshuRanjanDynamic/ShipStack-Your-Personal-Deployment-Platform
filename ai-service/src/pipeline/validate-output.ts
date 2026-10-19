import { LlmOutput } from "../../contracts/llm-output.js";
import { taxonomyById } from "../../taxonomy/schema.js";
import type { PreprocessedLine } from "./types.js";

export interface SemanticValidationOptions {
  lines: PreprocessedLine[];
  contextMissing?: boolean;
  truncated?: boolean;
  retrievedChunkIds?: Set<string>;
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
 * 6. Every cited source_chunk_id must have been in the retrieved chunk set.
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

  // 5. Phase 3 Citation Verification against retrieved chunks
  if (options.retrievedChunkIds) {
    for (let i = 0; i < (output.fix_steps || []).length; i++) {
      const step = output.fix_steps[i];
      if (step.source_chunk_id && !options.retrievedChunkIds.has(step.source_chunk_id)) {
        errors.push(
          `fix_steps[${i}] cites unknown chunk id "${step.source_chunk_id}". Only retrieved chunk IDs may be cited.`
        );
      }
    }

    for (const src of output.sources || []) {
      if (!options.retrievedChunkIds.has(src)) {
        errors.push(
          `sources contains unretrieved chunk id "${src}". Only retrieved chunk IDs may be cited.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 6. Semantic adjustments: confidence capping & UNKNOWN needs_human
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

  // Deduplicate sources list from cited steps
  const citedIds = Array.from(
    new Set([
      ...(output.sources || []),
      ...output.fix_steps
        .map((s) => s.source_chunk_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ])
  );

  const validatedData: LlmOutput = {
    ...output,
    sources: citedIds,
    confidence: Math.round(confidence * 100) / 100,
    needs_human: needsHuman,
  };

  return { isValid: true, data: validatedData };
}

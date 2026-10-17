import { z } from "zod";
import type { LlmOutput } from "../../contracts/llm-output.js";

// ────────────────────────────────────────────────────────────────────────────
// Pipeline types shared across all steps (Phase 2)
// ────────────────────────────────────────────────────────────────────────────

/**
 * A single log line with its stable 1-based line number assigned at fetch time.
 * Every later stage and every `evidence` reference uses `n`.
 */
export interface NumberedLine {
  /** Stable 1-based line number assigned at fetchContext time. */
  n: number;
  /** Raw log text (before preprocessing). */
  text: string;
  /** Build step parsed from step markers (e.g. "clone", "install", "build", "upload"). */
  step?: string;
}

/**
 * A preprocessed log line — cleaned, redacted, possibly truncated.
 * Line number `n` is preserved from the original NumberedLine.
 */
export interface PreprocessedLine {
  /** Stable 1-based line number (matches the original log line). */
  n: number;
  /** Cleaned/redacted text. */
  text: string;
  /** Build step parsed from step markers. */
  step?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Step results
// ────────────────────────────────────────────────────────────────────────────

/** Output of fetchContext (Step 1). */
export interface FetchContextResult {
  /** Raw log lines with stable 1-based line numbers. */
  logs: NumberedLine[];
  /** Build context loaded from S3 / fixtures, or null if missing. */
  buildContext: Record<string, unknown> | null;
  /** True if build-context.json was missing (lowers allowed confidence). */
  contextMissing: boolean;
  /** The original diagnosis request metadata. */
  request: {
    deployment_id: string;
    project_id: string;
    failed_step: string;
    exit_code: number;
    failure_reason: string;
    git_url: string;
  };
}

/** Output of preprocess (Step 2). */
export interface PreprocessResult {
  /** Preprocessed lines — cleaned, redacted, windowed. Line numbers preserved from fetch. */
  lines: PreprocessedLine[];
  /** String array of preprocessed line texts for easy downstream inspection. */
  cleanedLogs: string[];
  /** True if any content was cut (dedup, windowing, line truncation). */
  truncated: boolean;
  /** True if build-context was missing (forwarded from fetch). */
  contextMissing: boolean;
  /** Preprocessing statistics. */
  stats: {
    originalLineCount: number;
    afterDedup: number;
    afterWindowing: number;
    redactionsApplied: number;
    estimatedTokens: number;
    longLinesTruncated: number;
    progressBarsCollapsed: number;
  };
  /** Build context (forwarded from fetch). */
  buildContext: Record<string, unknown> | null;
  /** Original request metadata (forwarded from fetch). */
  request: FetchContextResult["request"];
}

/** Output of computeSignature (Step 3). */
export interface SignatureResult {
  /** SHA-256 hash of the normalized first error-window line. */
  signatureHash: string;
  /** Forwarded preprocessed data. */
  preprocess: PreprocessResult;
}

/** A single rule match from the rules classifier. */
export interface RuleMatch {
  /** Rule identifier. */
  ruleId: string;
  /** Taxonomy category. */
  category: string;
  /** Confidence of the match. */
  confidence: number;
  /** Evidence lines (real `n` values from preprocessed lines). */
  evidence: Array<{ line: number; text: string }>;
  /** Templated fix steps. */
  fixSteps: Array<{ step: string; type: "config" | "code" | "env" | "none" }>;
  /** Root cause description from the rule. */
  rootCause: string;
}

/** Output of applyRules (Step 4). */
export interface RulesResult {
  /** All rule matches found, sorted by confidence descending. */
  matches: RuleMatch[];
  /** The best match if it meets the confidence threshold, or null. */
  bestMatch: RuleMatch | null;
  /** True if rules short-circuited (hybrid mode, high-confidence single match). */
  shortCircuited: boolean;
  /** Forwarded signature data. */
  signature: SignatureResult;
}

/** Output of retrieveContext (Step 5). */
export interface RetrieveResult {
  /** Documents retrieved via hybrid RAG (empty list in Phase 1/2 stub). */
  retrievedDocs: string[];
  /** Forwarded rules result. */
  rules: RulesResult;
}

/** Diagnosis source values. */
export type DiagnosisSource = "RULES" | "LLM" | "LLM_FALLBACK" | "CACHE" | "STUB";

/** Final output of the full pipeline. */
export interface PipelineDiagnosisResult {
  category: string;
  confidence: number;
  rootCause: string;
  fixJson: {
    fix_steps: Array<{ step: string; type: "config" | "code" | "env" | "none" }>;
    evidence: Array<{ line: number; text: string }>;
    sources: string[];
    needs_human: boolean;
  };
  source: DiagnosisSource;
  /** SHA-256 signature hash for future cache lookups. */
  signatureHash: string;
  /** LLM model used, or null for rules-only. */
  model: string | null;
  /** Input tokens sent to LLM, or null. */
  tokensIn: number | null;
  /** Output tokens from LLM, or null. */
  tokensOut: number | null;
  /** LLM call latency in ms, or null. */
  latencyMs: number | null;
  /** Prompt version string (semver). */
  promptVersion: string;
  /** Pipeline version string (semver). */
  pipelineVersion: string;
}

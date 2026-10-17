import crypto from "crypto";
import { logger } from "../logger.js";
import type { PreprocessResult, SignatureResult } from "./types.js";

// Error line indicator patterns (matches candidate lines for signature hashing)
const ERROR_LINE_PATTERNS = [
  /\berror\b/i,
  /\bERR!\b/,
  /\bfailed\b/i,
  /\bfatal\b/i,
  /\bexception\b/i,
  /cannot find/i,
  /not found/i,
  /ELIFECYCLE/i,
  /exit code/i,
  /heap out of memory/i,
];

// Normalization regexes per PHASE2.md §5.3:
// absolute paths, hashes, timestamps, line:col, temp directory names
const TIMESTAMP_REGEX = /\b\d{4}-\d{2}-\d{2}[T_\s]\d{2}[:_]\d{2}[:_]\d{2}(?:[._]\d+)?Z?\b/g;
const HEX_HASH_REGEX = /\b[0-9a-f]{7,64}\b/gi;
const LINE_COL_REGEX = /:\d+(?::\d+)?\b/g;
const UNIX_PATH_REGEX = /(?:\/[\w.-]+){2,}/g;
const WINDOWS_PATH_REGEX = /[a-zA-Z]:\\(?:[\w.-]+\\)+[\w.-]*/g;
const TEMP_DIR_REGEX = /\b(?:tmp[0-9a-zA-Z_-]+|\.tmp[0-9a-zA-Z_-]*)\b/gi;
const STEP_PREFIX_REGEX = /^\[\w+\]\s*/;

/**
 * Normalizes an error line by stripping ephemeral tokens (paths, hashes, timestamps, line numbers)
 * so identical failures produce identical signature hashes.
 */
export function normalizeErrorLine(raw: string): string {
  if (!raw) return "";

  let line = raw.replace(STEP_PREFIX_REGEX, "").trim();

  // 1. Timestamps
  line = line.replace(TIMESTAMP_REGEX, "<TIMESTAMP>");

  // 2. Line:column references (:14:2 or :42)
  line = line.replace(LINE_COL_REGEX, ":<LINE>");

  // 3. Absolute filesystem paths (Linux & Windows)
  line = line.replace(WINDOWS_PATH_REGEX, "<PATH>");
  line = line.replace(UNIX_PATH_REGEX, "<PATH>");

  // 4. Temp directories
  line = line.replace(TEMP_DIR_REGEX, "<TEMP_DIR>");

  // 5. Hex hashes (git commit SHAs, build hashes, etc.)
  line = line.replace(HEX_HASH_REGEX, "<HASH>");

  // 6. Collapse extra whitespace
  line = line.replace(/\s+/g, " ").trim();

  return line;
}

/**
 * Computes SHA-256 hash of a normalized string.
 */
export function computeSha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Step 3: Compute signature hash.
 *
 * Implements PHASE2.md §5.3:
 * - Picks the first error-window line.
 * - Normalizes paths, hashes, timestamps, line:col, temp dirs.
 * - Hashes normalized string with SHA-256.
 * - Stores in Diagnosis.signatureHash. (Cache lookup is deferred to Phase 4).
 */
export function computeSignature(preprocessResult: PreprocessResult): SignatureResult {
  const startTime = Date.now();
  const lines = preprocessResult.lines;

  // Find first line matching error patterns (excluding gap markers)
  let chosenLine = "";
  for (const line of lines) {
    if (line.text.startsWith("[...")) continue;
    if (ERROR_LINE_PATTERNS.some((p) => p.test(line.text))) {
      chosenLine = line.text;
      break;
    }
  }

  // Fallback to last line or failed step metadata if no explicit error line
  if (!chosenLine) {
    const nonGapLines = lines.filter((l) => !l.text.startsWith("[..."));
    chosenLine = nonGapLines.length > 0
      ? nonGapLines[nonGapLines.length - 1].text
      : `Failed step: ${preprocessResult.request?.failed_step ?? "unknown"}`;
  }

  const normalized = normalizeErrorLine(chosenLine);
  const signatureHash = computeSha256(normalized);

  const durationMs = Date.now() - startTime;
  logger.info("Signature complete", {
    durationMs,
    signatureHash,
    rawSample: chosenLine.slice(0, 60),
    normalizedSample: normalized.slice(0, 60),
  });

  return {
    signatureHash,
    preprocess: preprocessResult,
  };
}

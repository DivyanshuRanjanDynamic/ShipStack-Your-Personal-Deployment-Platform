import { config } from "../config.js";
import { logger } from "../logger.js";
import { redactText } from "./redact.js";
import type { FetchContextResult, PreprocessedLine, PreprocessResult } from "./types.js";

// ANSI escape sequence regex
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// Error patterns for windowing (+/- 15 lines)
const ERROR_PATTERNS = [
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

// Progress bar and spinner patterns (matches anywhere or after step prefix)
const PROGRESS_BAR_REGEX = /(?:\[[=#\->\s]{5,}\]|\b\d{1,3}%\s+\[[=#\->\s]+\]|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*|\[progress:\s*\d+%\])/i;

/**
 * Strips ANSI codes and normalizes line endings.
 */
export function cleanLine(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(ANSI_REGEX, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

/**
 * Truncates long lines exceeding 500 characters, keeping head and tail.
 */
export function truncateLongLine(text: string, maxLength = 500): { text: string; wasTruncated: boolean } {
  if (text.length <= maxLength) return { text, wasTruncated: false };
  const keep = Math.floor((maxLength - 25) / 2);
  const head = text.slice(0, keep);
  const tail = text.slice(text.length - keep);
  return {
    text: `${head} ... [TRUNCATED] ... ${tail}`,
    wasTruncated: true,
  };
}

export interface PreprocessOptions {
  maxTokens?: number;
  projectEnvVarValues?: string[];
  lastNLines?: number;
  errorWindowRadius?: number;
}

/**
 * Step 2: Clean, redact, deduplicate, and window log lines.
 *
 * Implements PHASE2.md §5.2:
 * 1. Normalize line endings, strip ANSI
 * 2. Collapse progress bars / spinners
 * 3. Redact secrets using typed markers
 * 4. Truncate long lines (>500 chars)
 * 5. Collapse consecutive duplicate lines
 * 6. Window lines under token budget (keeping failed step start, tail, and error windows)
 * 7. Track truncation and stats
 */
export function preprocess(
  context: FetchContextResult,
  options: PreprocessOptions = {}
): PreprocessResult {
  const startTime = Date.now();
  const maxTokens = options.maxTokens ?? config.MAX_INPUT_TOKENS;
  const maxChars = maxTokens * 4;
  const lastNCount = options.lastNLines ?? 150;
  const windowRadius = options.errorWindowRadius ?? 15;

  const originalLines = context.logs;
  const originalLineCount = originalLines.length;

  let redactionsApplied = 0;
  let longLinesTruncated = 0;
  let progressBarsCollapsed = 0;
  let wasTruncated = false;

  // Step 1 - 4: Clean, collapse progress bars, redact, and truncate long lines
  const cleaned: PreprocessedLine[] = [];

  for (const item of originalLines) {
    const rawText = item.text || "";
    const stripped = cleanLine(rawText);

    // Skip progress bar noise
    if (PROGRESS_BAR_REGEX.test(stripped.trim())) {
      progressBarsCollapsed++;
      wasTruncated = true;
      continue;
    }

    // Redact secrets
    const redacted = redactText(stripped, {
      projectEnvVarValues: options.projectEnvVarValues,
    });
    if (redacted.redactionsCount > 0) {
      redactionsApplied += redacted.redactionsCount;
    }

    // Truncate long lines
    const trunc = truncateLongLine(redacted.text, 500);
    if (trunc.wasTruncated) {
      longLinesTruncated++;
      wasTruncated = true;
    }

    cleaned.push({
      n: item.n,
      text: trunc.text,
      step: item.step,
    });
  }

  // Step 5: Collapse consecutive duplicate lines
  const deduplicated: PreprocessedLine[] = [];
  let prevText: string | null = null;
  let repeatCount = 0;
  let repeatStartLine: PreprocessedLine | null = null;

  function flushRepeat() {
    if (!repeatStartLine) return;
    if (repeatCount === 1) {
      deduplicated.push(repeatStartLine);
    } else {
      deduplicated.push({
        n: repeatStartLine.n,
        text: `${repeatStartLine.text} (repeated ${repeatCount} times)`,
        step: repeatStartLine.step,
      });
      wasTruncated = true;
    }
  }

  for (const line of cleaned) {
    if (line.text === prevText) {
      repeatCount++;
    } else {
      flushRepeat();
      prevText = line.text;
      repeatCount = 1;
      repeatStartLine = line;
    }
  }
  flushRepeat();

  const afterDedup = deduplicated.length;

  // Step 6: Token-budget Windowing
  // Compute line indices to keep:
  // - first 30 lines of the failed step
  // - last N lines
  // - windows of +/- 15 lines around error patterns
  const keepIndices = new Set<number>();
  const totalCleaned = deduplicated.length;

  // 1. Failed step start (first 30 lines of failed step if present)
  const failedStep = context.request?.failed_step;
  let stepStartCount = 0;
  for (let i = 0; i < totalCleaned; i++) {
    if (failedStep && deduplicated[i].step === failedStep) {
      if (stepStartCount < 30) {
        keepIndices.add(i);
        stepStartCount++;
      }
    }
  }

  // 2. Last N lines
  const tailStart = Math.max(0, totalCleaned - lastNCount);
  for (let i = tailStart; i < totalCleaned; i++) {
    keepIndices.add(i);
  }

  // 3. Error pattern windows (+/- windowRadius)
  for (let i = 0; i < totalCleaned; i++) {
    const text = deduplicated[i].text;
    const isError = ERROR_PATTERNS.some((p) => p.test(text));
    if (isError) {
      const start = Math.max(0, i - windowRadius);
      const end = Math.min(totalCleaned - 1, i + windowRadius);
      for (let j = start; j <= end; j++) {
        keepIndices.add(j);
      }
    }
  }

  // If total lines fit within maxChars easily and not all indices were kept, check if we even need windowing
  const fullTextLength = deduplicated.reduce((sum, l) => sum + l.text.length + 1, 0);
  const needsWindowing = fullTextLength > maxChars || keepIndices.size < totalCleaned;

  const windowedLines: PreprocessedLine[] = [];
  if (!needsWindowing) {
    windowedLines.push(...deduplicated);
  } else {
    wasTruncated = true;
    const sortedIndices = Array.from(keepIndices).sort((a, b) => a - b);
    let prevIdx = -1;

    for (const idx of sortedIndices) {
      if (prevIdx !== -1 && idx > prevIdx + 1) {
        const gap = idx - prevIdx - 1;
        windowedLines.push({
          n: deduplicated[prevIdx].n,
          text: `[... ${gap} lines omitted ...]`,
        });
      }
      windowedLines.push(deduplicated[idx]);
      prevIdx = idx;
    }
  }

  // Final check: if still exceeding character budget, drop non-error lines first
  let currentTotalChars = windowedLines.reduce((sum, l) => sum + l.text.length + 1, 0);
  while (currentTotalChars > maxChars && windowedLines.length > 5) {
    wasTruncated = true;
    const nonErrorIdx = windowedLines.findIndex(
      (l) => !ERROR_PATTERNS.some((p) => p.test(l.text)) && !l.text.startsWith("[...")
    );
    if (nonErrorIdx !== -1) {
      const removed = windowedLines.splice(nonErrorIdx, 1)[0];
      currentTotalChars -= removed.text.length + 1;
    } else {
      const removed = windowedLines.shift()!;
      currentTotalChars -= removed.text.length + 1;
    }
  }

  const estimatedTokens = Math.ceil(currentTotalChars / 4);

  const durationMs = Date.now() - startTime;
  logger.info("Preprocess complete", {
    originalLines: originalLineCount,
    finalLines: windowedLines.length,
    redactions: redactionsApplied,
    truncated: wasTruncated,
    estimatedTokens,
    durationMs,
  });

  return {
    lines: windowedLines,
    cleanedLogs: windowedLines.map((l) => l.text),
    truncated: wasTruncated,
    contextMissing: context.contextMissing,
    stats: {
      originalLineCount,
      afterDedup,
      afterWindowing: windowedLines.length,
      redactionsApplied,
      estimatedTokens,
      longLinesTruncated,
      progressBarsCollapsed,
    },
    buildContext: context.buildContext,
    request: context.request,
  };
}

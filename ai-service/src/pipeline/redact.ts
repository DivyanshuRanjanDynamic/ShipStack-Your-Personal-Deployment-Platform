/**
 * Secrets Redaction Engine (Phase 2, §5.2)
 *
 * Runs BEFORE any log text is stored, prompted, or logged.
 * Replaces sensitive data with typed markers:
 * - [REDACTED:aws_key]
 * - [REDACTED:github_token]
 * - [REDACTED:bearer_token]
 * - [REDACTED:private_key]
 * - [REDACTED:jwt]
 * - [REDACTED:credentials]
 * - [REDACTED:secret]
 * - [REDACTED:env_var]
 */

export interface RedactOptions {
  /**
   * Exact values of project-configured environment variables.
   * Only values with length >= 6 are redacted to prevent redacting short words.
   */
  projectEnvVarValues?: string[];
}

export interface RedactResult {
  text: string;
  redactionsCount: number;
}

// Regex patterns for well-known secrets
const AWS_ACCESS_KEY_REGEX = /\b(AKIA[0-9A-Z]{16})\b/g;
const GITHUB_TOKEN_REGEX = /\b(gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g;
const BEARER_TOKEN_REGEX = /(Bearer\s+)(?!\[REDACTED)([\w\-.~+/]+=*)/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+PRIVATE KEY-----/g;
const JWT_REGEX = /\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g;
const URL_CREDENTIALS_REGEX = /((?:https?|ftp):\/\/)(?!\[REDACTED)([^:\s\/@]+):([^@\s\/]+)@/g;
// Matches KEY=VALUE or KEY: VALUE where key name matches SECRET|TOKEN|PASSWORD|KEY|CREDENTIAL per spec
const KEY_VALUE_SECRET_REGEX = /((?:[\w.-]*(?:SECRET|TOKEN|PASSWORD|KEY|CREDENTIAL)[\w.-]*)\s*[:=]\s*)(['"][^'"\r\n]{3,}['"]|[^\s\r\n,;]{3,})/gi;

/**
 * Redacts secrets from a given text string.
 */
export function redactText(text: string, options: RedactOptions = {}): RedactResult {
  if (!text) return { text: "", redactionsCount: 0 };

  let count = 0;
  let result = text;

  // 1. Private key blocks
  result = result.replace(PRIVATE_KEY_REGEX, () => {
    count++;
    return "[REDACTED:private_key]";
  });

  // 2. AWS Access Key IDs
  result = result.replace(AWS_ACCESS_KEY_REGEX, () => {
    count++;
    return "[REDACTED:aws_key]";
  });

  // 3. GitHub Tokens
  result = result.replace(GITHUB_TOKEN_REGEX, () => {
    count++;
    return "[REDACTED:github_token]";
  });

  // 4. JWT tokens
  result = result.replace(JWT_REGEX, () => {
    count++;
    return "[REDACTED:jwt]";
  });

  // 5. Bearer tokens (keep the "Bearer " prefix for context)
  result = result.replace(BEARER_TOKEN_REGEX, (match, prefix, token) => {
    if (token.startsWith("[REDACTED:")) return match;
    count++;
    return `${prefix}[REDACTED:bearer_token]`;
  });

  // 6. URL credentials (http://user:password@host)
  result = result.replace(URL_CREDENTIALS_REGEX, (match, scheme, user, pass) => {
    if (user.includes("[REDACTED") || pass.includes("[REDACTED")) return match;
    count++;
    return `${scheme}[REDACTED:credentials]@`;
  });

  // 7. Project environment variable values (exact matches, length >= 6)
  if (options.projectEnvVarValues && options.projectEnvVarValues.length > 0) {
    // Sort longest first to avoid partial replacements
    const sortedVals = [...new Set(options.projectEnvVarValues)]
      .filter((v) => typeof v === "string" && v.trim().length >= 6)
      .sort((a, b) => b.length - a.length);

    for (const secretVal of sortedVals) {
      if (result.includes(secretVal)) {
        // Escape special regex characters
        const escaped = secretVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "g");
        result = result.replace(regex, (match) => {
          if (match.includes("[REDACTED:")) return match;
          count++;
          return "[REDACTED:env_var]";
        });
      }
    }
  }

  // 8. KEY=VALUE secret assignments
  result = result.replace(KEY_VALUE_SECRET_REGEX, (match, prefix, val) => {
    if (val.includes("[REDACTED:")) return match;
    count++;
    return `${prefix}[REDACTED:secret]`;
  });

  return { text: result, redactionsCount: count };
}

import { describe, it, expect } from "vitest";
import { preprocess, cleanLine, truncateLongLine } from "../src/pipeline/preprocess.js";
import type { FetchContextResult } from "../src/pipeline/types.js";

describe("Preprocess Step (Phase 2, §5.2)", () => {
  function makeContext(lines: string[], failedStep = "build"): FetchContextResult {
    return {
      logs: lines.map((text, idx) => ({
        n: idx + 1,
        text,
        step: text.startsWith("[") ? text.slice(1, text.indexOf("]")) : failedStep,
      })),
      buildContext: { framework: "vite" },
      contextMissing: false,
      request: {
        deployment_id: "dep-prep-1",
        project_id: "proj-1",
        failed_step: failedStep,
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/org/repo",
      },
    };
  }

  it("strips ANSI color and control codes", () => {
    const raw = "\u001b[31m\u001b[1mError:\u001b[22m\u001b[39m Failed to compile \u001b[33m./src/index.ts\u001b[39m";
    const cleaned = cleanLine(raw);
    expect(cleaned).toBe("Error: Failed to compile ./src/index.ts");
  });

  it("truncates lines longer than 500 characters", () => {
    const longString = "A".repeat(600);
    const result = truncateLongLine(longString, 500);
    expect(result.wasTruncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(500);
    expect(result.text).toContain("... [TRUNCATED] ...");
    expect(result.text.startsWith("AAAA")).toBe(true);
    expect(result.text.endsWith("AAAA")).toBe(true);
  });

  it("preserves original 1-based line numbers (n) across transformations", () => {
    const context = makeContext([
      "[install] line 1",
      "[install] [=====>    ] 50%", // progress bar -> removed
      "[install] line 3 with error",
      "[install] line 4",
      "[build] line 5 duplicate",
      "[build] line 5 duplicate", // consecutive dupe -> collapsed into line 5
      "[build] line 7",
    ]);

    const result = preprocess(context, { maxTokens: 1000 });

    // Every remaining line must retain its original 1-based line number
    for (const line of result.lines) {
      expect(typeof line.n).toBe("number");
      expect(line.n).toBeGreaterThan(0);
    }

    const lineNumbers = result.lines.map((l) => l.n);
    expect(lineNumbers).toContain(1);
    expect(lineNumbers).toContain(3);
    // Line 2 (progress bar) was omitted
    expect(lineNumbers).not.toContain(2);
    // Line 5 was kept as repeat parent
    expect(lineNumbers).toContain(5);
  });

  it("redacts seeded secrets before output", () => {
    const context = makeContext([
      "Fetching with AKIAIOSFODNN7EXAMPLE",
      "Git token is ghp_1234567890abcdefghijklmnopqrstuvwxyzAB",
      "Using Authorization: Bearer super_secret_bearer_token",
      "Database URL: https://dbuser:superSecretPassword@postgres.host:5432/db",
      "Config: STRIPE_KEY=sk_test_51Abcdef123456789",
      "Custom secret: my_custom_super_secret_env_value",
    ]);

    const result = preprocess(context, {
      projectEnvVarValues: ["my_custom_super_secret_env_value"],
    });

    const fullText = result.lines.map((l) => l.text).join("\n");

    expect(fullText).toContain("[REDACTED:aws_key]");
    expect(fullText).toContain("[REDACTED:github_token]");
    expect(fullText).toContain("[REDACTED:bearer_token]");
    expect(fullText).toContain("[REDACTED:credentials]");
    expect(fullText).toContain("[REDACTED:secret]");
    expect(fullText).toContain("[REDACTED:env_var]");

    // Verify none of the raw secrets survived
    expect(fullText).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(fullText).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyzAB");
    expect(fullText).not.toContain("superSecretPassword");
    expect(fullText).not.toContain("sk_test_51Abcdef123456789");
    expect(fullText).not.toContain("my_custom_super_secret_env_value");
  });

  it("enforces token budget and marks truncated = true", () => {
    // Generate 500 lines of logs
    const lines: string[] = [];
    for (let i = 1; i <= 500; i++) {
      if (i === 250) {
        lines.push(`[build] Line ${i}: fatal error: Module not found 'foo'`);
      } else {
        lines.push(`[build] Line ${i}: standard compiler output and debug info here`);
      }
    }

    const context = makeContext(lines);
    // Restrict budget to 200 tokens (~800 characters)
    const result = preprocess(context, { maxTokens: 200 });

    expect(result.truncated).toBe(true);
    expect(result.stats.estimatedTokens).toBeLessThanOrEqual(250); // within small tolerance
    // Error line around 250 should be preserved
    const hasError = result.lines.some((l) => l.text.includes("Module not found 'foo'"));
    expect(hasError).toBe(true);
  });

  it("collapses consecutive duplicate lines", () => {
    const context = makeContext([
      "Waiting for connection...",
      "Waiting for connection...",
      "Waiting for connection...",
      "Connected!",
    ]);

    const result = preprocess(context);
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].text).toBe("Waiting for connection... (repeated 3 times)");
    expect(result.lines[1].text).toBe("Connected!");
  });

  it("is idempotent: preprocessing already-preprocessed text preserves content", () => {
    const context1 = makeContext([
      "Compiling 12 files...",
      "Error: cannot find module 'react'",
      "Build failed with exit code 1",
    ]);

    const result1 = preprocess(context1);

    // Feed result1 lines into a second context
    const context2: FetchContextResult = {
      logs: result1.lines.map((l) => ({ n: l.n, text: l.text, step: l.step })),
      buildContext: result1.buildContext,
      contextMissing: result1.contextMissing,
      request: context1.request,
    };

    const result2 = preprocess(context2);

    expect(result2.lines.map((l) => l.text)).toEqual(result1.lines.map((l) => l.text));
    expect(result2.lines.map((l) => l.n)).toEqual(result1.lines.map((l) => l.n));
  });
});

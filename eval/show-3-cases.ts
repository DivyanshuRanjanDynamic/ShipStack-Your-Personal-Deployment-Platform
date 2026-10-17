import fs from "fs/promises";
import path from "path";

// Load environment variables from ai-service/.env
const envPath = path.resolve(import.meta.dirname, "../ai-service/.env");
if (process.loadEnvFile) process.loadEnvFile(envPath);

async function run() {
  const { parseRawLogs } = await import("../ai-service/src/pipeline/fetchContext.js");
  const { preprocess } = await import("../ai-service/src/pipeline/preprocess.js");
  const { computeSignature } = await import("../ai-service/src/pipeline/signature.js");
  const { applyRules } = await import("../ai-service/src/pipeline/rules.js");
  const { diagnose } = await import("../ai-service/src/pipeline/diagnose.js");
  const caseIds = ["DEPENDENCY_CONFLICT-01", "DEPENDENCY_CONFLICT-02", "MODULE_NOT_FOUND-01"];

  for (const id of caseIds) {
    const caseDir = path.resolve(import.meta.dirname, "cases", id);
    const logs = await fs.readFile(path.join(caseDir, "logs.txt"), "utf-8");
    const numbered = parseRawLogs(logs);

    let buildContext = {};
    try {
      buildContext = JSON.parse(await fs.readFile(path.join(caseDir, "build-context.json"), "utf-8"));
    } catch { }

    const preprocessed = preprocess({
      logs: numbered,
      buildContext,
      contextMissing: false,
      request: {
        deployment_id: id,
        project_id: "eval-project",
        failed_step: id.startsWith("DEP") ? "install" : "build",
        exit_code: 1,
        failure_reason: "NONZERO_EXIT",
        git_url: "https://github.com/example/repo",
      },
    });

    const signature = computeSignature(preprocessed);
    const rules = applyRules(signature, { mode: "llm" });
    const result = await diagnose(rules);

    console.log(`\n================================================================`);
    console.log(`CASE: ${id}`);
    console.log(`================================================================`);
    console.log(`\n--- REDACTED PREPROCESSED LOG SAMPLE (Lines around key error) ---`);
    const keyLines = preprocessed.lines
      .filter((l) => /error|ERESOLVE|resolve|Rollup|cannot find/i.test(l.text))
      .slice(0, 5);
    for (const l of keyLines) {
      console.log(`  [Line ${l.n}] ${l.text}`);
    }

    console.log(`\n--- VALIDATED LLM OUTPUT ---`);
    console.log(
      JSON.stringify(
        {
          category: result.category,
          confidence: result.confidence,
          root_cause: result.rootCause,
          fix_steps: result.fixJson.fix_steps,
          evidence: result.fixJson.evidence,
          source: result.source,
          needs_human: result.fixJson.needs_human,
          latencyMs: result.latencyMs,
          tokens: { in: result.tokensIn, out: result.tokensOut },
        },
        null,
        2
      )
    );
  }
}

run().catch(console.error);

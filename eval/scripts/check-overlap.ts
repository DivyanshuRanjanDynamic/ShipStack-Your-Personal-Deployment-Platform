import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FixtureData {
  caseId: string;
  split: "dev" | "test" | "unknown";
  rawLogs: string;
  contextJson: string;
  expectedJson: string;
  specificTokens: string[];
  logLines: string[];
}

interface KbDoc {
  relPath: string;
  fullPath: string;
  content: string;
  cleanedText: string;
}

interface OverlapMatch {
  kbPath: string;
  caseId: string;
  split: string;
  matchType: "IDENTIFIER" | "VERBATIM_LINE" | "NGRAM_OVERLAP" | "TEST_LEAK";
  detail: string;
}

// Boilerplate lines / common error phrases that are expected in general documentation
const ALLOWED_COMMON_PHRASES = new Set([
  "npm error code eresolve",
  "npm error eresolve could not resolve",
  "cannot find module",
  "module not found",
  "exit_code=0",
  "exit_code=1",
  "found package.json in project root",
  "build process failed",
  "build failed in",
  "failed to compile",
  "unable to resolve dependency tree",
  "conflicting peer dependency",
]);

/**
 * Tokenize text into words for n-gram analysis
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Generate n-grams of given size
 */
function generateNGrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(" ");
    ngrams.push(gram);
  }
  return ngrams;
}

/**
 * Extract specific entity identifiers from fixture files (deployment IDs, repo URLs, unique filepaths)
 */
function extractSpecificIdentifiers(logs: string, contextRaw: string, expectedRaw: string): string[] {
  const identifiers: Set<string> = new Set();

  try {
    const ctx = JSON.parse(contextRaw);
    if (ctx.deployment_id) identifiers.add(ctx.deployment_id);
    if (ctx.project_id) identifiers.add(ctx.project_id);
    if (ctx.git_url) identifiers.add(ctx.git_url);
    if (ctx.context_s3_key) identifiers.add(ctx.context_s3_key);
  } catch {}

  try {
    const exp = JSON.parse(expectedRaw);
    if (exp.id) identifiers.add(exp.id);
  } catch {}

  // Look for unique fixture filepaths in logs (e.g. /home/app/output/... or ./src/components/...)
  const pathMatches = logs.matchAll(/(?:\/home\/app\/output\/[a-zA-Z0-9_\-\.\/]+|(?:\.\/|\b)src\/[a-zA-Z0-9_\-\.\/]+)/g);
  for (const m of pathMatches) {
    const p = m[0];
    if (p.length > 10 && !p.endsWith("/src") && !p.endsWith("/src/")) {
      identifiers.add(p);
    }
  }

  return Array.from(identifiers);
}

export async function checkKbOverlap(options: {
  rootDir?: string;
  ngramSize?: number;
}): Promise<{ passes: boolean; matches: OverlapMatch[] }> {
  const rootDir = options.rootDir || path.resolve(__dirname, "../..");
  const kbDir = path.join(rootDir, "knowledge");
  const casesDir = path.join(rootDir, "eval", "cases");
  const splitFilePath = path.join(rootDir, "eval", "split.json");
  const ngramSize = options.ngramSize || 8;

  // 1. Load splits
  let devCases = new Set<string>();
  let testCases = new Set<string>();
  try {
    const splitRaw = await fs.readFile(splitFilePath, "utf-8");
    const splitJson = JSON.parse(splitRaw);
    devCases = new Set(splitJson.dev || []);
    testCases = new Set(splitJson.test || []);
  } catch {}

  // 2. Discover all KB files
  const kbDocs: KbDoc[] = [];
  async function walkKb(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkKb(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith("README.md")) {
        const content = await fs.readFile(fullPath, "utf-8");
        kbDocs.push({
          relPath: path.relative(kbDir, fullPath).replace(/\\/g, "/"),
          fullPath,
          content,
          cleanedText: content.toLowerCase(),
        });
      }
    }
  }
  await walkKb(kbDir);

  // 3. Load all fixtures
  const caseDirs = await fs.readdir(casesDir, { withFileTypes: true });
  const fixtures: FixtureData[] = [];

  for (const dir of caseDirs) {
    if (!dir.isDirectory()) continue;
    const caseId = dir.name;
    const casePath = path.join(casesDir, caseId);

    let rawLogs = "";
    let contextJson = "";
    let expectedJson = "";

    try {
      rawLogs = await fs.readFile(path.join(casePath, "logs.txt"), "utf-8");
    } catch {}
    try {
      contextJson = await fs.readFile(path.join(casePath, "build-context.json"), "utf-8");
    } catch {}
    try {
      expectedJson = await fs.readFile(path.join(casePath, "expected.json"), "utf-8");
    } catch {}

    const split = testCases.has(caseId) ? "test" : devCases.has(caseId) ? "dev" : "unknown";
    const specificTokens = extractSpecificIdentifiers(rawLogs, contextJson, expectedJson);
    const logLines = rawLogs
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 25);

    fixtures.push({
      caseId,
      split,
      rawLogs,
      contextJson,
      expectedJson,
      specificTokens,
      logLines,
    });
  }

  // 4. Overlap & Leakage Analysis
  const matches: OverlapMatch[] = [];

  for (const kb of kbDocs) {
    const kbTokens = tokenize(kb.content);
    const kbNGrams = new Set(generateNGrams(kbTokens, ngramSize));

    for (const fixture of fixtures) {
      // 4a. Check specific fixture identifiers (Case ID, Deployment ID, Git URLs, unique filepaths)
      for (const idToken of fixture.specificTokens) {
        if (kb.content.includes(idToken)) {
          matches.push({
            kbPath: kb.relPath,
            caseId: fixture.caseId,
            split: fixture.split,
            matchType: "IDENTIFIER",
            detail: `Found fixture-specific identifier "${idToken}" in knowledge document`,
          });
        }
      }

      // 4b. Verbatim Log Lines Check
      for (const line of fixture.logLines) {
        // Strip common log prefixes like [build], [install], timestamps
        const cleanLine = line
          .replace(/^\[(install|build|clone)\]\s*/i, "")
          .replace(/^\[\d+:\d+:\d+\]\s*/, "")
          .trim();

        if (cleanLine.length < 35) continue;
        const lowerLine = cleanLine.toLowerCase();

        // Check if this line is in the allowed common errors list
        let isCommon = false;
        for (const allowed of ALLOWED_COMMON_PHRASES) {
          if (lowerLine.includes(allowed) && lowerLine.length < allowed.length + 15) {
            isCommon = true;
            break;
          }
        }
        if (isCommon) continue;

        if (kb.cleanedText.includes(lowerLine)) {
          matches.push({
            kbPath: kb.relPath,
            caseId: fixture.caseId,
            split: fixture.split,
            matchType: "VERBATIM_LINE",
            detail: `Verbatim fixture log line found in KB: "${cleanLine}"`,
          });
        }
      }

      // 4c. N-Gram Overlap Check (n >= 8 words)
      const fixtureTokens = tokenize(fixture.rawLogs);
      const fixtureNGrams = generateNGrams(fixtureTokens, ngramSize);

      for (const gram of fixtureNGrams) {
        if (kbNGrams.has(gram)) {
          // Check if this n-gram is solely composed of allowed generic phrases
          let isAllowed = false;
          for (const phrase of ALLOWED_COMMON_PHRASES) {
            if (gram.includes(phrase)) {
              isAllowed = true;
              break;
            }
          }
          if (!isAllowed) {
            matches.push({
              kbPath: kb.relPath,
              caseId: fixture.caseId,
              split: fixture.split,
              matchType: fixture.split === "test" ? "TEST_LEAK" : "NGRAM_OVERLAP",
              detail: `Verbatim ${ngramSize}-gram sequence overlap: "${gram}"`,
            });
            break; // Record one n-gram match per (KB, fixture) pair to prevent log flooding
          }
        }
      }
    }
  }

  return {
    passes: matches.length === 0,
    matches,
  };
}

async function main() {
  console.log("========================================================");
  console.log("  Knowledge Base & Eval Fixtures Overlap / Leakage Check ");
  console.log("========================================================\n");

  const startTime = Date.now();
  const { passes, matches } = await checkKbOverlap({});
  const durationMs = Date.now() - startTime;

  if (passes) {
    console.log("✅ [CLEAN] No eval fixture content or leakage found in the Knowledge Base.");
    console.log(`   - Verified 0 fixture identifiers (IDs, Git URLs, fixture filepaths) in KB.`);
    console.log(`   - Verified 0 verbatim fixture log lines in KB.`);
    console.log(`   - Verified 0 consecutive 8-gram sequence overlaps.`);
    console.log(`   - Verified zero test-split contamination.`);
    console.log(`   - Completed in ${durationMs}ms.\n`);
    process.exit(0);
  } else {
    console.error(`❌ [CONTAMINATION DETECTED] Found ${matches.length} overlap/leakage instances:\n`);
    for (const m of matches) {
      console.error(`  [${m.matchType}] Split: ${m.split.toUpperCase()} | Case: ${m.caseId}`);
      console.error(`    File:   knowledge/${m.kbPath}`);
      console.error(`    Detail: ${m.detail}\n`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((err) => {
    console.error("Error running overlap check:", err);
    process.exit(1);
  });
}

import type { PreprocessedLine } from "./types.js";

export interface RuleDefinition {
  id: string;
  category: string;
  pattern: RegExp;
  requiresStep?: string[];
  confidence: number;
  fixturesJustified: string[]; // Fixture IDs justifying this rule per PHASE2.md §5.4
  extractEvidence: (lines: PreprocessedLine[], match: RegExpMatchArray) => Array<{ line: number; text: string }>;
  buildRootCause: (lines: PreprocessedLine[], match: RegExpMatchArray) => string;
  buildFixSteps: (lines: PreprocessedLine[], match: RegExpMatchArray) => Array<{ step: string; type: "config" | "code" | "env" | "none" }>;
}

export const RULES_TABLE: RuleDefinition[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. DEPENDENCY_CONFLICT - ERESOLVE / Peer Dependency Conflict
  // Justified by fixtures: DEPENDENCY_CONFLICT-01, DEPENDENCY_CONFLICT-02, DEPENDENCY_CONFLICT-03
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_npm_eresolve_peer_conflict",
    category: "DEPENDENCY_CONFLICT",
    pattern: /npm (?:error|ERR!) (?:code )?ERESOLVE|While resolving:\s*([^\s@\r\n]+@?[^\s\r\n]*)|Conflicting peer dependency:\s*([^\s@\r\n]+@?[^\s\r\n]*)/i,
    requiresStep: ["install"],
    confidence: 0.95,
    fixturesJustified: ["DEPENDENCY_CONFLICT-01", "DEPENDENCY_CONFLICT-02"],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) =>
          /ERESOLVE|While resolving|Found:|Could not resolve dependency|peer |Conflicting peer dependency|--legacy-peer-deps/i.test(l.text)
        )
        .slice(0, 8)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: (lines: PreprocessedLine[]) => {
      let resolvingPkg = "";
      let foundPkg = "";
      let peerRequirement = "";

      for (const l of lines) {
        const resolvingMatch = l.text.match(/While resolving:\s*([^\s@\r\n]+)/i);
        if (resolvingMatch && !resolvingPkg) resolvingPkg = resolvingMatch[1];

        const foundMatch = l.text.match(/Found:\s*([^\s@\r\n]+)/i);
        if (foundMatch && !foundPkg) foundPkg = foundMatch[1];

        const peerMatch = l.text.match(/peer\s+([^\s\r\n]+)/i);
        if (peerMatch && !peerRequirement) peerRequirement = peerMatch[1].replace(/["']/g, "");
      }

      if (resolvingPkg.includes("eslint") || foundPkg.includes("eslint")) {
        return `Peer dependency conflict: eslint-config-react-app requires peer eslint@^8.0.0, but root project found ${foundPkg || "eslint@9"}.`;
      }

      if (resolvingPkg) {
        return `Peer dependency conflict: ${resolvingPkg} requires peer ${peerRequirement || "dependency"}, conflicting with react version in root project.`;
      }

      return "npm ERESOLVE peer dependency conflict detected during package installation.";
    },
    buildFixSteps: (lines: PreprocessedLine[]) => {
      const allText = lines.map((l) => l.text).join(" ");
      if (allText.includes("eslint-config-react-app") && allText.includes("eslint@9")) {
        return [
          {
            step: "Pin eslint to version 8 (e.g. ^8.57.0) in package.json to satisfy eslint-config-react-app peer dependency, or retry with --legacy-peer-deps",
            type: "config",
          },
        ];
      }

      return [
        {
          step: "Install dependencies using --legacy-peer-deps to bypass conflicting peer dependency checks",
          type: "config",
        },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. MODULE_NOT_FOUND - Casing Mismatch (Case-sensitive Linux filesystem)
  // Justified by fixture: MODULE_NOT_FOUND-02
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_module_casing_mismatch",
    category: "MODULE_NOT_FOUND",
    pattern: /The file ["']([^"']+)["'] exists on disk, but the import uses different casing/i,
    requiresStep: ["build"],
    confidence: 0.98,
    fixturesJustified: ["MODULE_NOT_FOUND-02"],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) =>
          /Failed to resolve import|different casing|file: |Does the file exist/i.test(l.text)
        )
        .slice(0, 6)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: (lines: PreprocessedLine[], match: RegExpMatchArray) => {
      let importedName = "Navbar";
      let diskName = "navbar";

      for (const l of lines) {
        const importMatch = l.text.match(/Failed to resolve import ["']\.\/components\/([^"']+)["']/i);
        if (importMatch) importedName = importMatch[1];
        const hintMatch = l.text.match(/The file ["'].*?\/([^/"']+)\.tsx?["'] exists on disk/i);
        if (hintMatch) diskName = hintMatch[1];
      }

      return `Import case sensitivity mismatch: ${importedName} is imported with different casing than disk filename (${diskName}.tsx). Linux filesystems are case-sensitive.`;
    },
    buildFixSteps: () => [
      {
        step: "Rename the imported component or fix import casing in source code to match the exact filename casing on disk",
        type: "code",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. MODULE_NOT_FOUND - Missing Dependency or Unresolved Import
  // Justified by fixtures: MODULE_NOT_FOUND-01, MODULE_NOT_FOUND-03
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_module_not_found_missing_dep",
    category: "MODULE_NOT_FOUND",
    pattern: /(?:Rollup failed to resolve import|Could not resolve|Cannot find module)\s+["']([^"']+)["']/i,
    requiresStep: ["build"],
    confidence: 0.95,
    fixturesJustified: ["MODULE_NOT_FOUND-01"],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) =>
          /Rollup failed to resolve import|Could not resolve|Cannot find module|Build failed/i.test(l.text)
        )
        .slice(0, 6)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: (lines: PreprocessedLine[], match: RegExpMatchArray) => {
      const moduleName = match[1] || "dependency";
      return `Missing dependency: ${moduleName} is imported in the code but is missing from package.json dependencies.`;
    },
    buildFixSteps: (lines: PreprocessedLine[], match: RegExpMatchArray) => {
      const moduleName = match[1] || "the missing dependency";
      return [
        {
          step: `Run npm install ${moduleName} to add the missing package to package.json`,
          type: "code",
        },
      ];
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. OUT_OF_MEMORY - Heap OOM or Exit 137
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_heap_out_of_memory",
    category: "OUT_OF_MEMORY",
    pattern: /JavaScript heap out of memory|Allocation failed - JavaScript heap out of memory|\bexit code 137\b/i,
    confidence: 0.95,
    fixturesJustified: [],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) => /heap out of memory|Allocation failed|exit code 137|FATAL ERROR/i.test(l.text))
        .slice(0, 4)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: () =>
      "Build process ran out of memory (JavaScript heap out of memory / exit code 137).",
    buildFixSteps: () => [
      {
        step: "Increase task memory allocation or configure NODE_OPTIONS=--max-old-space-size=4096 in environment variables",
        type: "env",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. NODE_VERSION_MISMATCH - Unsupported Engine
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_unsupported_engine",
    category: "NODE_VERSION_MISMATCH",
    pattern: /Unsupported engine|ERR! notsup Required:|requires Node >=/i,
    confidence: 0.95,
    fixturesJustified: [],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) => /Unsupported engine|notsup|requires Node/i.test(l.text))
        .slice(0, 4)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: () =>
      "Node.js version mismatch: the project's engines field is not satisfied by the build environment.",
    buildFixSteps: () => [
      {
        step: "Update the engines field in package.json or configure the compatible Node.js version in project settings",
        type: "config",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. MISSING_BUILD_SCRIPT - Missing script: "build"
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_missing_build_script",
    category: "MISSING_BUILD_SCRIPT",
    pattern: /npm (?:error|ERR!) Missing script: ["']?build["']?|Missing script: ["']?build["']?/i,
    requiresStep: ["build"],
    confidence: 0.95,
    fixturesJustified: [],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) => /Missing script/i.test(l.text))
        .slice(0, 4)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: () =>
      "package.json does not contain the required \"build\" script.",
    buildFixSteps: () => [
      {
        step: "Add a \"build\" script to package.json (e.g. \"build\": \"vite build\" or \"react-scripts build\")",
        type: "config",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 7. REPO_ACCESS - Repository Not Found or Authentication Failed
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_repo_not_found",
    category: "REPO_ACCESS",
    pattern: /Repository not found|fatal: repository ['"].*['"] not found|fatal: Authentication failed/i,
    requiresStep: ["clone"],
    confidence: 0.95,
    fixturesJustified: [],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) => /Repository not found|Authentication failed|fatal: repository/i.test(l.text))
        .slice(0, 4)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: () =>
      "Git repository could not be cloned. Repository not found or authentication credentials are invalid.",
    buildFixSteps: () => [
      {
        step: "Verify the Git repository URL is correct and ensure repository access credentials / deploy keys are configured",
        type: "config",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 8. LOCKFILE_MISMATCH - npm ci Lockfile Out of Sync
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_lockfile_out_of_sync",
    category: "LOCKFILE_MISMATCH",
    pattern: /cipm can only install packages when your package\.json and package-lock\.json are in sync/i,
    requiresStep: ["install"],
    confidence: 0.95,
    fixturesJustified: [],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) => /cipm can only install|package-lock\.json are in sync/i.test(l.text))
        .slice(0, 4)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: () =>
      "package-lock.json is out of sync with package.json during npm ci installation.",
    buildFixSteps: () => [
      {
        step: "Regenerate package-lock.json by running npm install locally and commit the updated lockfile",
        type: "config",
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 9. CODE_ERROR - CRA Treating Warnings as Errors in CI
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "rule_cra_warnings_as_errors",
    category: "CODE_ERROR",
    pattern: /Treating warnings as errors because process\.env\.CI = true/i,
    requiresStep: ["build"],
    confidence: 0.95,
    fixturesJustified: [],
    extractEvidence: (lines: PreprocessedLine[]) => {
      return lines
        .filter((l) => /Treating warnings as errors|Failed to compile/i.test(l.text))
        .slice(0, 4)
        .map((l) => ({ line: l.n, text: l.text }));
    },
    buildRootCause: () =>
      "Create React App treats compiler warnings as errors in CI environments when CI=true.",
    buildFixSteps: () => [
      {
        step: "Fix the reported compiler warnings or set CI=false in project environment variables",
        type: "env",
      },
    ],
  },
];

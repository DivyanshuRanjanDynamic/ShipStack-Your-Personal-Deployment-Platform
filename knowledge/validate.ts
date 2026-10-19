import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { KbFrontmatterSchema, type KbFrontmatter, type ValidatedKbEntry, type SourceReference } from "./schema.js";

export type { ValidatedKbEntry, KbFrontmatter, SourceReference };

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /password\s*[:=]\s*['"][^'"]+['"]/i,
];

/**
 * Extracts frontmatter YAML block and markdown body from file content.
 */
export function parseMarkdownWithFrontmatter(rawContent: string): { yamlText: string; body: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Missing YAML frontmatter block enclosed by '---'");
  }
  return {
    yamlText: match[1],
    body: match[2].trim(),
  };
}

/**
 * Lightweight YAML parser for frontmatter without requiring heavy dependencies.
 * Handles strings, booleans, and string arrays.
 */
export function parseSimpleYaml(yamlText: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yamlText.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentList: any[] | null = null;
  let currentObjectListKey: string | null = null;
  let currentObjectListItem: Record<string, any> | null = null;

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // Check for list item under an object array (e.g. sources: - url: ...)
    const objListItemMatch = line.match(/^(\s*)-\s+([a-zA-Z0-9_]+):\s*(.*)$/);
    if (objListItemMatch) {
      const indent = objListItemMatch[1].length;
      const key = objListItemMatch[2];
      let val: any = objListItemMatch[3].trim();
      val = unquote(val);

      if (currentObjectListKey && indent >= 2) {
        if (!Array.isArray(result[currentObjectListKey])) {
          result[currentObjectListKey] = [];
        }
        currentObjectListItem = { [key]: val };
        result[currentObjectListKey].push(currentObjectListItem);
        continue;
      }
    }

    // Property under an object list item
    const objPropMatch = line.match(/^\s{4,}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (objPropMatch && currentObjectListItem) {
      const propKey = objPropMatch[1];
      let propVal: any = objPropMatch[2].trim();
      propVal = unquote(propVal);
      currentObjectListItem[propKey] = propVal;
      continue;
    }

    // List item under a string array
    const listMatch = line.match(/^(\s*)-\s*(.*)$/);
    if (listMatch && currentKey && !currentObjectListKey) {
      let val = listMatch[2].trim();
      val = unquote(val);
      if (!currentList) {
        currentList = [];
        result[currentKey] = currentList;
      }
      currentList.push(val);
      continue;
    }

    // Top-level key: value
    const kvMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      currentList = null;
      currentObjectListItem = null;
      const rest = kvMatch[2].trim();

      if (rest === "") {
        // Could be start of list or object array
        if (currentKey === "sources") {
          currentObjectListKey = currentKey;
          result[currentKey] = [];
        } else {
          currentObjectListKey = null;
          currentList = [];
          result[currentKey] = currentList;
        }
      } else if (rest.startsWith("[") && rest.endsWith("]")) {
        // Inline array: [vite, cra]
        currentObjectListKey = null;
        const inner = rest.slice(1, -1).trim();
        result[currentKey] = inner ? inner.split(",").map((s) => unquote(s.trim())) : [];
      } else if (rest === "true") {
        currentObjectListKey = null;
        result[currentKey] = true;
      } else if (rest === "false") {
        currentObjectListKey = null;
        result[currentKey] = false;
      } else {
        currentObjectListKey = null;
        result[currentKey] = unquote(rest);
      }
    }
  }

  return result;
}

function unquote(val: string): any {
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

/**
 * Validates a single knowledge file and returns its structured representation.
 */
export async function validateKbFile(filePath: string): Promise<ValidatedKbEntry | null> {
  const rawContent = await fs.readFile(filePath, "utf-8");

  // Check for forbidden secret strings
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(rawContent)) {
      throw new Error(`File contains potential secret or credential matching ${pattern}`);
    }
  }

  const { yamlText, body } = parseMarkdownWithFrontmatter(rawContent);
  const parsedYaml = parseSimpleYaml(yamlText);

  const frontmatter = KbFrontmatterSchema.parse(parsedYaml);

  if (!frontmatter.reviewed) {
    // Unverified entries are marked reviewed: false and must not be ingested per PHASE3.md §16
    return null;
  }

  if (body.length < 50) {
    throw new Error(`Entry body is too short (${body.length} chars). Must provide actionable guidance.`);
  }

  // Construct embed text for vector + keyword search
  const embedText = [
    `Title: ${frontmatter.title}`,
    `Applies to: ${frontmatter.appliesTo}`,
    `Symptoms:\n${frontmatter.symptoms.map((s: string) => `- ${s}`).join("\n")}`,
    `Error Signatures:\n${frontmatter.errorSignatures.map((e: string) => `- ${e}`).join("\n")}`,
  ].join("\n\n");

  return {
    frontmatter,
    rawContent,
    body,
    filePath,
    embedText,
  };
}

/**
 * Scans knowledge directory and validates all markdown entries.
 */
export async function validateKnowledgeBase(kbDir: string): Promise<ValidatedKbEntry[]> {
  const entries: ValidatedKbEntry[] = [];
  const seenIds = new Set<string>();

  async function walk(currentDir: string) {
    const files = await fs.readdir(currentDir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(currentDir, file.name);
      if (file.isDirectory()) {
        await walk(fullPath);
      } else if (file.isFile() && file.name.endsWith(".md") && !file.name.endsWith("README.md") && !file.name.endsWith("LICENSE.md")) {
        try {
          const entry = await validateKbFile(fullPath);
          if (!entry) continue; // Skip unverified entries marked reviewed: false
          if (seenIds.has(entry.frontmatter.id)) {
            throw new Error(`Duplicate chunk ID "${entry.frontmatter.id}" already exists in KB.`);
          }
          seenIds.add(entry.frontmatter.id);
          entries.push(entry);
        } catch (err: any) {
          throw new Error(`Validation failed for ${path.relative(kbDir, fullPath)}: ${err.message}`);
        }
      }
    }
  }

  await walk(kbDir);
  return entries;
}

// Direct execution from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const kbDir = path.dirname(fileURLToPath(import.meta.url));
  console.log(`Validating knowledge base at ${kbDir}...`);
  validateKnowledgeBase(kbDir)
    .then((validEntries) => {
      console.log(`✅ All ${validEntries.length} knowledge base entries are valid!`);
    })
    .catch((err) => {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    });
}

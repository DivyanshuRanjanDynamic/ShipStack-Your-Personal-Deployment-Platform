import fs from "fs/promises";
import path from "path";
import { ExpectedCase } from "../expected-schema.js";
import { BuildContext } from "../../ai-service/contracts/index.js";

async function main() {
  const casesDir = path.join(import.meta.dirname, "..", "cases");
  const dirs = await fs.readdir(casesDir, { withFileTypes: true });
  
  let valid = 0;
  let errors = 0;

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const casePath = path.join(casesDir, dir.name);
    
    // 1. Validate expected.json
    try {
      const expectedPath = path.join(casePath, "expected.json");
      const expectedData = JSON.parse(await fs.readFile(expectedPath, "utf-8"));
      ExpectedCase.parse(expectedData);
      
      // Ensure the ID in expected.json matches the directory name
      if (expectedData.id !== dir.name) {
        throw new Error(`Directory name (${dir.name}) does not match ID in expected.json (${expectedData.id})`);
      }
    } catch (e) {
      console.error(`[❌] ${dir.name}/expected.json invalid:`, e instanceof Error ? e.message : e);
      errors++;
      continue;
    }

    // 2. Validate build-context.json
    try {
      const contextPath = path.join(casePath, "build-context.json");
      const contextData = JSON.parse(await fs.readFile(contextPath, "utf-8"));
      BuildContext.parse(contextData);
    } catch (e) {
      console.error(`[❌] ${dir.name}/build-context.json invalid:`, e instanceof Error ? e.message : e);
      errors++;
      continue;
    }

    // 3. Ensure logs.txt exists and is not empty
    try {
      const logsPath = path.join(casePath, "logs.txt");
      const logs = await fs.readFile(logsPath, "utf-8");
      if (logs.trim().length === 0) throw new Error("logs.txt is empty");
    } catch (e) {
      console.error(`[❌] ${dir.name}/logs.txt invalid:`, e instanceof Error ? e.message : e);
      errors++;
      continue;
    }

    console.log(`[✅] ${dir.name}`);
    valid++;
  }

  // 4. Validate split.json completeness
  try {
    const splitPath = path.join(import.meta.dirname, "..", "split.json");
    const split = JSON.parse(await fs.readFile(splitPath, "utf-8"));
    const allSplitCases = new Set([...split.dev, ...split.test]);
    const caseDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);
    
    for (const id of caseDirs) {
      if (!allSplitCases.has(id)) {
        console.warn(`[⚠️] Case ${id} is not assigned to dev or test in split.json`);
      }
    }
  } catch (e) {
    console.error(`[❌] Failed to validate split.json completeness`);
  }

  console.log(`\nValidation complete. ${valid} passed, ${errors} failed.`);
  if (errors > 0) process.exit(1);
}

main().catch(console.error);

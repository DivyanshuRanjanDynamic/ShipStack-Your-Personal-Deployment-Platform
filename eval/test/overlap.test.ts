import { describe, it } from "node:test";
import assert from "node:assert";
import { checkKbOverlap } from "../scripts/check-overlap.js";

describe("Knowledge Base Overlap & Leakage Check", () => {
  it("verifies zero fixture overlap or leakage in the current knowledge base", async () => {
    const result = await checkKbOverlap({});
    assert.strictEqual(
      result.passes,
      true,
      `Expected zero overlap, but found ${result.matches.length} matches: ${JSON.stringify(result.matches)}`
    );
    assert.strictEqual(result.matches.length, 0);
  });
});

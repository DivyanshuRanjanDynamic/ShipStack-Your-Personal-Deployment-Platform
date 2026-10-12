import { describe, it, expect } from "vitest";
import { Taxonomy, TaxonomyEntry, CategoryId, taxonomy, taxonomyById } from "./schema.js";
import rawTaxonomy from "./taxonomy.json" with { type: "json" };

describe("taxonomy.json", () => {
  it("parses without errors", () => {
    expect(() => Taxonomy.parse(rawTaxonomy)).not.toThrow();
  });

  it("contains exactly 13 entries (12 categories + UNKNOWN)", () => {
    expect(taxonomy).toHaveLength(13);
  });

  it("has no duplicate ids", () => {
    const ids = taxonomy.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes UNKNOWN as the last category", () => {
    expect(taxonomy[taxonomy.length - 1].id).toBe("UNKNOWN");
  });

  it("every entry has at least one requires_step", () => {
    for (const entry of taxonomy) {
      expect(entry.requires_step.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("UNKNOWN has empty log_signatures", () => {
    const unknown = taxonomyById.get("UNKNOWN");
    expect(unknown).toBeDefined();
    expect(unknown!.log_signatures).toEqual([]);
  });

  it("every non-UNKNOWN entry has at least one log_signature", () => {
    for (const entry of taxonomy) {
      if (entry.id === "UNKNOWN") continue;
      expect(entry.log_signatures.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("taxonomyById lookup works for all entries", () => {
    for (const entry of taxonomy) {
      expect(taxonomyById.get(entry.id)).toBe(entry);
    }
  });
});

describe("TaxonomyEntry schema (negative tests)", () => {
  it("rejects an entry with a missing id", () => {
    const bad = {
      description: "test",
      log_signatures: [],
      typical_fix: "fix",
      requires_step: ["build"],
    };
    expect(TaxonomyEntry.safeParse(bad).success).toBe(false);
  });

  it("rejects an entry with an invalid id", () => {
    const bad = {
      id: "NOT_A_REAL_CATEGORY",
      description: "test",
      log_signatures: [],
      typical_fix: "fix",
      requires_step: ["build"],
    };
    expect(TaxonomyEntry.safeParse(bad).success).toBe(false);
  });

  it("rejects an entry with an invalid step", () => {
    const bad = {
      id: "CODE_ERROR",
      description: "test",
      log_signatures: ["error"],
      typical_fix: "fix",
      requires_step: ["deploy"],
    };
    expect(TaxonomyEntry.safeParse(bad).success).toBe(false);
  });

  it("rejects an entry with empty description", () => {
    const bad = {
      id: "CODE_ERROR",
      description: "",
      log_signatures: ["error"],
      typical_fix: "fix",
      requires_step: ["build"],
    };
    expect(TaxonomyEntry.safeParse(bad).success).toBe(false);
  });

  it("rejects an entry with empty requires_step", () => {
    const bad = {
      id: "CODE_ERROR",
      description: "test",
      log_signatures: ["error"],
      typical_fix: "fix",
      requires_step: [],
    };
    expect(TaxonomyEntry.safeParse(bad).success).toBe(false);
  });
});

describe("CategoryId enum", () => {
  it("accepts all 13 valid category ids", () => {
    const expected = [
      "NODE_VERSION_MISMATCH",
      "DEPENDENCY_CONFLICT",
      "MODULE_NOT_FOUND",
      "MISSING_BUILD_SCRIPT",
      "WRONG_OUTPUT_DIR",
      "OUT_OF_MEMORY",
      "BUILD_TIMEOUT",
      "MISSING_ENV_VAR",
      "CODE_ERROR",
      "LOCKFILE_MISMATCH",
      "REPO_ACCESS",
      "UNSUPPORTED_PROJECT",
      "UNKNOWN",
    ];
    for (const id of expected) {
      expect(CategoryId.safeParse(id).success).toBe(true);
    }
  });

  it("rejects invalid category ids", () => {
    expect(CategoryId.safeParse("INVALID").success).toBe(false);
    expect(CategoryId.safeParse("").success).toBe(false);
    expect(CategoryId.safeParse(123).success).toBe(false);
  });
});

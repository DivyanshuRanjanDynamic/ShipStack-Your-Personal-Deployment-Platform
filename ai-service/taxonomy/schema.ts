import { z } from "zod";
import taxonomyData from "./taxonomy.json" with { type: "json" };

/**
 * The closed set of build steps that a failure can occur in.
 * Matches the step markers emitted by build-server.
 */
export const BuildStep = z.enum(["clone", "install", "build", "upload"]);
export type BuildStep = z.infer<typeof BuildStep>;

/**
 * All valid taxonomy category IDs, derived from taxonomy.json.
 * This is the single source of truth — downstream schemas import this enum.
 */
const categoryIds = taxonomyData.map((c) => c.id) as [string, ...string[]];
export const CategoryId = z.enum(categoryIds);
export type CategoryId = z.infer<typeof CategoryId>;

/**
 * Schema for a single entry in taxonomy.json.
 */
export const TaxonomyEntry = z.object({
  id: CategoryId,
  description: z.string().min(1),
  log_signatures: z.array(z.string()),
  typical_fix: z.string().min(1),
  requires_step: z.array(BuildStep).min(1),
});
export type TaxonomyEntry = z.infer<typeof TaxonomyEntry>;

/**
 * Schema for the full taxonomy.json file — a non-empty array of entries.
 */
export const Taxonomy = z.array(TaxonomyEntry).min(1);
export type Taxonomy = z.infer<typeof Taxonomy>;

/**
 * Validated, typed taxonomy data. Throws at import time if taxonomy.json is invalid.
 */
export const taxonomy: Taxonomy = Taxonomy.parse(taxonomyData);

/**
 * Lookup: category ID → TaxonomyEntry.
 */
export const taxonomyById = new Map(taxonomy.map((e) => [e.id, e]));

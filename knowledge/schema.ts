import { z, CategoryId } from "../ai-service/taxonomy/schema.js";

/**
 * Frontmatter schema for external sources citation.
 */
export const SourceReferenceSchema = z.object({
  url: z.string().url("source url must be a valid URL"),
  license: z.string().min(1, "license identifier is required"),
  commitSha: z.string().optional(),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "retrievedAt must be YYYY-MM-DD"),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

/**
 * Frontmatter schema for knowledge base entries (playbooks & external doc sections).
 */
export const KbFrontmatterSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-_]+$/, "id must be alphanumeric with dashes/underscores"),
  title: z.string().min(5, "title must be at least 5 characters"),
  category: CategoryId,
  framework: z.array(z.string()).default([]),
  packageManager: z.array(z.string()).default([]),
  symptoms: z.array(z.string().min(3)).min(1, "at least one symptom is required"),
  errorSignatures: z.array(z.string().min(2)).min(1, "at least one error signature is required"),
  appliesTo: z.string().min(3, "appliesTo must be specified"),
  sources: z.array(SourceReferenceSchema).min(1, "at least one source reference is required"),
  reviewed: z.boolean(),
});
export type KbFrontmatter = z.infer<typeof KbFrontmatterSchema>;

/**
 * Validated in-memory knowledge chunk representation.
 */
export interface ValidatedKbEntry {
  frontmatter: KbFrontmatter;
  rawContent: string;
  body: string;
  filePath: string;
  embedText: string;
}

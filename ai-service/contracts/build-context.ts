import { z } from "zod";

/**
 * Schema for build-context.json, written to S3 at __meta/{deployment_id}/
 * by the build-server after clone, before install.
 *
 * Rules (from spec §5.2):
 * - Never include env var values or secrets. Env var names only, if included.
 * - Missing fields are null, never omitted.
 */
export const BuildContext = z.object({
  deployment_id: z.string().min(1),
  git_url: z.string().url(),
  framework: z
    .enum(["vite", "cra", "next", "gatsby", "angular", "astro", "vue", "svelte", "unknown"])
    .nullable(),
  package_manager: z.enum(["npm", "yarn", "pnpm"]).nullable(),
  node_version: z.string().nullable(),
  engines: z.record(z.string()).nullable(),
  scripts: z.record(z.string()).nullable(),
  build_command: z.string().nullable(),
  expected_output_dir: z.string().nullable(),
  has_lockfile: z.boolean(),
  captured_at: z.string().datetime(),
  // Step 9 (build-server fixes): truthful, resolved build details. Optional for backward
  // compatibility with build-context.json written before this change; the build-server now
  // always writes them (string/boolean, or null when not yet known).
  root_directory: z.string().nullish(),
  install_command: z.string().nullish(),
  node_selected_from: z.string().nullish(),
  legacy_openssl: z.boolean().nullish(),
  output_dir_resolved: z.string().nullish(),
});
export type BuildContext = z.infer<typeof BuildContext>;

import { z } from "zod";
import { CategoryId } from "../ai-service/taxonomy/schema.js";

export const ExpectedCase = z.object({
  id: z.string().min(1),
  category: CategoryId,
  secondary_categories: z.array(CategoryId),
  root_cause_must_mention: z.array(z.string()).min(1),
  fix_must_mention: z.array(z.string()).min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  framework: z.enum(["vite", "cra", "next", "unknown"]),
  package_manager: z.enum(["npm", "yarn", "pnpm"]),
  relevant_kb_ids: z.array(z.string()).default([]),
});

export type ExpectedCase = z.infer<typeof ExpectedCase>;

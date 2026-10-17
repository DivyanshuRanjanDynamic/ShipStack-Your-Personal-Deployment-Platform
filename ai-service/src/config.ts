import "dotenv/config";
import { z } from "zod";

/**
 * Diagnosis operating mode.
 * - rules: rules classifier only, no LLM calls
 * - llm: LLM only, skip rules
 * - hybrid: rules short-circuit high-confidence matches, LLM for the rest
 */
const DiagnosisMode = z.enum(["rules", "llm", "hybrid"]);

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  API_GRPC_URL: z.string().default("localhost:50051"),

  // ── Kafka ──
  KAFKA_BROKER: z.string().default("localhost:9092"),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_CA_CERT_PATH: z.string().optional(),
  KAFKA_GROUP_ID: z.string().default("ai-service-diagnosis"),
  DIAGNOSIS_TOPIC: z.string().default("diagnosis-requests"),
  DIAGNOSIS_DLQ_TOPIC: z.string().default("diagnosis-requests.dlq"),

  // ── Guardrails ──
  MAX_DIAGNOSES_PER_DAY: z.coerce.number().int().positive().default(500),

  // ── Phase 2: Diagnosis mode ──
  DIAGNOSIS_MODE: DiagnosisMode.default("hybrid"),

  // ── Phase 2: LLM provider ──
  LLM_PROVIDER: z.string().default("groq"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL_PRIMARY: z.string().default("openai/gpt-oss-120b"),
  LLM_MODEL_ESCALATION: z.string().optional(),

  // ── Phase 2: Thresholds ──
  ESCALATION_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  RULES_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.9),

  // ── Phase 2: Limits ──
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(6000),
  LOG_FETCH_LIMIT: z.coerce.number().int().positive().default(5000),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Loads and validates environment configuration.
 * Fails fast with a clear message listing all missing/invalid variables.
 *
 * When DIAGNOSIS_MODE is "llm" or "hybrid", LLM_API_KEY is required.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`ai-service startup failed: Invalid environment configuration:\n${formatted}`);
  }

  const cfg = result.data;

  // LLM_API_KEY is required when mode needs LLM calls
  if ((cfg.DIAGNOSIS_MODE === "llm" || cfg.DIAGNOSIS_MODE === "hybrid") && !cfg.LLM_API_KEY) {
    throw new Error(
      `ai-service startup failed: LLM_API_KEY is required when DIAGNOSIS_MODE is "${cfg.DIAGNOSIS_MODE}". ` +
      `Set the environment variable or switch to DIAGNOSIS_MODE=rules.`
    );
  }

  return cfg;
}

// In test environment, config can be loaded lazily/mocked; in runtime, load directly
export const config: Config = process.env.NODE_ENV === "test"
  ? {
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/test",
    KAFKA_BROKER: process.env.KAFKA_BROKER || "localhost:9092",
    KAFKA_USERNAME: process.env.KAFKA_USERNAME,
    KAFKA_PASSWORD: process.env.KAFKA_PASSWORD,
    KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "ai-service-diagnosis",
    DIAGNOSIS_TOPIC: process.env.DIAGNOSIS_TOPIC || "diagnosis-requests",
    DIAGNOSIS_DLQ_TOPIC: process.env.DIAGNOSIS_DLQ_TOPIC || "diagnosis-requests.dlq",
    MAX_DIAGNOSES_PER_DAY: 500,
    DIAGNOSIS_MODE: "hybrid" as const,
    LLM_PROVIDER: "groq",
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL_PRIMARY: process.env.LLM_MODEL_PRIMARY || "openai/gpt-oss-120b", // M4 audit fix: aligned with production default
    LLM_MODEL_ESCALATION: process.env.LLM_MODEL_ESCALATION,
    ESCALATION_CONFIDENCE_THRESHOLD: 0.6,
    RULES_CONFIDENCE_THRESHOLD: 0.9,
    LLM_TIMEOUT_MS: 30000,
    MAX_INPUT_TOKENS: 6000,
    LOG_FETCH_LIMIT: 5000,
  } as Config
  : loadConfig();

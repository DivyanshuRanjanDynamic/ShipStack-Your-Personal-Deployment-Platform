import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  API_GRPC_URL: z.string().default("localhost:50051"),
  KAFKA_BROKER: z.string().min(1, "KAFKA_BROKER is required"),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_CA_CERT_PATH: z.string().optional(),
  KAFKA_GROUP_ID: z.string().default("ai-service-diagnosis"),
  DIAGNOSIS_TOPIC: z.string().default("diagnosis-requests"),
  DIAGNOSIS_DLQ_TOPIC: z.string().default("diagnosis-requests.dlq"),
  MAX_DIAGNOSES_PER_DAY: z.coerce.number().int().positive().default(500),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`ai-service startup failed: Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}

// In test environment, config can be loaded lazily/mocked; in runtime, load directly
export const config = process.env.NODE_ENV === "test"
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
  }
  : loadConfig();

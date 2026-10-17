import fs from "fs";
import { Kafka, Consumer, Producer } from "kafkajs";
import { DiagnosisRequest } from "../contracts/diagnosis-request.js";
import { Config, config as defaultConfig } from "./config.js";
import { logger } from "./logger.js";
import { diagnosisStore, DiagnosisStore } from "./store/diagnosis.js";
import { runPipeline } from "./pipeline/index.js";
import type { PipelineDiagnosisResult } from "./pipeline/types.js";

export interface DlqMessage {
  original_message: unknown;
  error: string;
  received_at: string;
}

export type DlqPublisher = (message: DlqMessage) => Promise<void>;

interface DailyDiagnosisTracker {
  date: string;
  count: number;
}

let dailyTracker: DailyDiagnosisTracker = {
  date: new Date().toISOString().slice(0, 10),
  count: 0,
};

export function checkAndIncrementDailyCap(maxLimit: number = defaultConfig.MAX_DIAGNOSES_PER_DAY): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyTracker.date !== today) {
    dailyTracker = { date: today, count: 0 };
  }
  if (dailyTracker.count >= maxLimit) {
    return false;
  }
  dailyTracker.count++;
  return true;
}

export function resetDailyCap(): void {
  dailyTracker = {
    date: new Date().toISOString().slice(0, 10),
    count: 0,
  };
}

/**
 * Release a daily cap slot when a pipeline run fails all retries.
 * Prevents failed attempts (no LLM call billed) from consuming cap budget.
 */
export function decrementDailyCap(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyTracker.date === today && dailyTracker.count > 0) {
    dailyTracker.count--;
  }
}

export function getDailyDiagnosisCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyTracker.date !== today) {
    return 0;
  }
  return dailyTracker.count;
}

/**
 * Core message processor: handles validation, DLQ on invalid,
 * idempotency check, daily cap check, 3 retries with backoff, and marking DONE/FAILED.
 */
export async function processMessage(
  rawValue: string | Buffer | null,
  store: DiagnosisStore = diagnosisStore,
  publishDlq: DlqPublisher,
  pipelineRunner: (req: DiagnosisRequest) => Promise<PipelineDiagnosisResult> = runPipeline,
  cfg: Config = defaultConfig
): Promise<{ status: "done" | "skipped" | "dlq" | "failed"; error?: string }> {
  if (!rawValue) {
    logger.warn("Received empty Kafka message, publishing to DLQ");
    await publishDlq({
      original_message: null,
      error: "Empty message payload",
      received_at: new Date().toISOString(),
    });
    return { status: "dlq", error: "Empty message payload" };
  }

  const rawString = typeof rawValue === "string" ? rawValue : rawValue.toString("utf-8");

  // 1. JSON parse
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawString);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to parse JSON from Kafka message, routing to DLQ", err, { messageLength: rawString.length });
    await publishDlq({
      original_message: rawString,
      error: `Invalid JSON: ${errorMsg}`,
      received_at: new Date().toISOString(),
    });
    return { status: "dlq", error: `Invalid JSON: ${errorMsg}` };
  }

  // 2. Zod contract validation
  const validationResult = DiagnosisRequest.safeParse(parsedJson);
  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    logger.warn("Message failed DiagnosisRequest contract validation, routing to DLQ", {
      validationError: errorMsg,
      parsedJson,
    });
    await publishDlq({
      original_message: parsedJson,
      error: `Contract validation failed: ${errorMsg}`,
      received_at: new Date().toISOString(),
    });
    return { status: "dlq", error: errorMsg };
  }

  const request = validationResult.data;
  const deploymentId = request.deployment_id;

  // 3. Idempotency: upsert to PENDING, skip if already DONE
  const upsertStatus = await store.upsertPending(deploymentId);
  if (upsertStatus.isAlreadyDone) {
    logger.info(`Deployment ${deploymentId} is already DONE, skipping pipeline execution`, { deploymentId });
    return { status: "skipped" };
  }

  // 3.5 Daily cap check
  if (!checkAndIncrementDailyCap(cfg.MAX_DIAGNOSES_PER_DAY)) {
    logger.warn(`Daily diagnosis limit of ${cfg.MAX_DIAGNOSES_PER_DAY} reached for ${deploymentId}. Returning UNKNOWN fallback.`);
    await store.markDone(deploymentId, {
      category: "UNKNOWN",
      confidence: 0,
      rootCause: "Daily AI diagnosis limit reached. Please inspect build logs manually.",
      fixJson: {
        fix_steps: [],
        evidence: [],
        sources: ["daily_cap_exceeded"],
        needs_human: true,
      },
      source: "RULES",
      signatureHash: "",
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      promptVersion: "2.0.0",
      pipelineVersion: "2.0.0",
      needsHuman: true,
    });
    return { status: "done" };
  }

  // 4. Run pipeline with up to 3 retries and backoff
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Running pipeline attempt ${attempt}/${maxRetries} for ${deploymentId}`, {
        deploymentId,
        attempt,
      });
      const diagnosisResult = await pipelineRunner(request);

      // Write DONE row with Phase 2 fields
      await store.markDone(deploymentId, {
        category: diagnosisResult.category,
        confidence: diagnosisResult.confidence,
        rootCause: diagnosisResult.rootCause,
        fixJson: diagnosisResult.fixJson,
        source: diagnosisResult.source,
        signatureHash: diagnosisResult.signatureHash,
        model: diagnosisResult.model,
        tokensIn: diagnosisResult.tokensIn,
        tokensOut: diagnosisResult.tokensOut,
        latencyMs: diagnosisResult.latencyMs,
        promptVersion: diagnosisResult.promptVersion,
        pipelineVersion: diagnosisResult.pipelineVersion,
        needsHuman: diagnosisResult.fixJson?.needs_human,
      });

      return { status: "done" };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`Pipeline attempt ${attempt}/${maxRetries} failed for ${deploymentId}: ${lastError.message}`, {
        deploymentId,
        attempt,
        error: lastError.message,
      });

      if (attempt < maxRetries) {
        const backoffMs = attempt * 150;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // 5. If failed after max retries, mark FAILED and publish to DLQ
  // H2 audit fix: release the daily cap slot so failed attempts don't consume budget
  decrementDailyCap();

  const finalErrorMsg = lastError?.message || "Pipeline failed after maximum retries";
  logger.error(`Pipeline exhausted retries for deployment ${deploymentId}`, lastError, { deploymentId });

  await store.markFailed(deploymentId, finalErrorMsg);
  await publishDlq({
    original_message: request,
    error: finalErrorMsg,
    received_at: new Date().toISOString(),
  });

  return { status: "failed", error: finalErrorMsg };
}

/**
 * Creates and starts the Kafka consumer service.
 */
export async function startConsumer(cfg: Config = defaultConfig) {
  const kafkaConfig: any = {
    clientId: `ai-service-${process.pid}`,
    brokers: [cfg.KAFKA_BROKER],
  };

  if (cfg.KAFKA_USERNAME && cfg.KAFKA_PASSWORD) {
    kafkaConfig.sasl = {
      mechanism: "PLAIN",
      username: cfg.KAFKA_USERNAME,
      password: cfg.KAFKA_PASSWORD,
    };
    if (cfg.KAFKA_CA_CERT_PATH && fs.existsSync(cfg.KAFKA_CA_CERT_PATH)) {
      kafkaConfig.ssl = {
        ca: [fs.readFileSync(cfg.KAFKA_CA_CERT_PATH, "utf-8")],
      };
    } else {
      kafkaConfig.ssl = true;
    }
  }

  const kafka = new Kafka(kafkaConfig);
  const consumer = kafka.consumer({ groupId: cfg.KAFKA_GROUP_ID });
  const producer = kafka.producer();

  await producer.connect();
  await consumer.connect();
  logger.info(`Connected Kafka consumer (groupId: ${cfg.KAFKA_GROUP_ID}) and DLQ producer`);

  await consumer.subscribe({ topic: cfg.DIAGNOSIS_TOPIC, fromBeginning: false });

  const dlqPublisher: DlqPublisher = async (dlqMsg: DlqMessage) => {
    await producer.send({
      topic: cfg.DIAGNOSIS_DLQ_TOPIC,
      messages: [
        {
          key: (dlqMsg.original_message as any)?.deployment_id || "unknown",
          value: JSON.stringify(dlqMsg),
        },
      ],
    });
    logger.info(`Published message to DLQ topic ${cfg.DIAGNOSIS_DLQ_TOPIC}`);
  };

  let isStopping = false;

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ message, topic, partition, heartbeat }) => {
      if (isStopping) return;

      const rawVal = message.value;
      const key = message.key?.toString() || "unknown";

      logger.info(`Received diagnosis request message`, {
        topic,
        partition,
        offset: message.offset,
        key,
      });

      await processMessage(rawVal, diagnosisStore, dlqPublisher, runPipeline);

      // Commit offset ONLY after diagnosis row is written or sent to DLQ
      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: (BigInt(message.offset) + 1n).toString(),
        },
      ]);
      await heartbeat();
    },
  });

  const stop = async () => {
    if (isStopping) return;
    isStopping = true;
    logger.info("Stopping Kafka consumer gracefully...");
    try {
      await consumer.stop();
      await consumer.disconnect();
      await producer.disconnect();
      logger.info("Kafka consumer and producer disconnected cleanly");
    } catch (err) {
      logger.error("Error disconnecting Kafka consumer:", err);
    }
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  return { consumer, producer, stop };
}

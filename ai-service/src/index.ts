import { config } from "./config.js";
import { logger } from "./logger.js";
import { startConsumer } from "./consumer.js";

async function main() {
  logger.info("Starting ai-service...", {
    nodeEnv: config.NODE_ENV,
    kafkaGroupId: config.KAFKA_GROUP_ID,
    diagnosisTopic: config.DIAGNOSIS_TOPIC,
    dlqTopic: config.DIAGNOSIS_DLQ_TOPIC,
  });

  try {
    await startConsumer(config);
    logger.info("ai-service is running and listening for diagnosis requests.");
  } catch (err) {
    logger.error("Failed to start ai-service:", err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("Unhandled error in main:", err);
    process.exit(1);
  });
}

import fs from "fs";
import { Kafka } from "kafkajs";
import { DiagnosisRequest } from "../contracts/diagnosis-request.js";
import { config } from "../src/config.js";
import { logger } from "../src/logger.js";

async function publishTestMessage() {
  const deploymentId = process.argv[2] || `test-dep-${Date.now()}`;
  const projectId = process.argv[3] || `test-proj-123`;

  const testPayload: DiagnosisRequest = {
    deployment_id: deploymentId,
    project_id: projectId,
    user_id: null,
    git_url: "https://github.com/example/repo",
    failed_step: "build",
    exit_code: 1,
    failure_reason: "NONZERO_EXIT",
    context_s3_key: `__meta/${deploymentId}/build-context.json`,
    failed_at: new Date().toISOString(),
    stop_code: "EssentialContainerExited",
    stopped_reason: "Process exited with code 1",
  };

  // Validate payload before sending
  const validated = DiagnosisRequest.parse(testPayload);

  logger.info(`Connecting to Kafka at ${config.KAFKA_BROKER}...`);

  const kafkaConfig: any = {
    clientId: "publish-test-message-script",
    brokers: [config.KAFKA_BROKER],
  };

  if (config.KAFKA_USERNAME && config.KAFKA_PASSWORD) {
    kafkaConfig.sasl = {
      mechanism: "PLAIN",
      username: config.KAFKA_USERNAME,
      password: config.KAFKA_PASSWORD,
    };
    if (config.KAFKA_CA_CERT_PATH && fs.existsSync(config.KAFKA_CA_CERT_PATH)) {
      kafkaConfig.ssl = {
        ca: [fs.readFileSync(config.KAFKA_CA_CERT_PATH, "utf-8")],
      };
    } else {
      kafkaConfig.ssl = true;
    }
  }

  const kafka = new Kafka(kafkaConfig);
  const producer = kafka.producer();

  await producer.connect();
  logger.info(`Connected to Kafka. Publishing test message to ${config.DIAGNOSIS_TOPIC}...`);

  await producer.send({
    topic: config.DIAGNOSIS_TOPIC,
    messages: [
      {
        key: validated.deployment_id,
        value: JSON.stringify(validated),
      },
    ],
  });

  logger.info(`Successfully published test message!`, {
    topic: config.DIAGNOSIS_TOPIC,
    deploymentId: validated.deployment_id,
  });

  await producer.disconnect();
}

publishTestMessage().catch((err) => {
  console.error("Error publishing test message:", err);
  process.exit(1);
});

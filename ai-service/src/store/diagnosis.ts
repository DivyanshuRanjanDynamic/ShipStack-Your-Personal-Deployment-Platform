import path from "path";
import { fileURLToPath } from "url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, "../../../proto/diagnosis.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const diagnosisProto = (grpc.loadPackageDefinition(packageDefinition) as any).diagnosis;

const grpcClient = new diagnosisProto.DiagnosisService(
  process.env.API_GRPC_URL || "localhost:50051",
  grpc.credentials.createInsecure()
);

export interface DiagnosisStore {
  upsertPending(deploymentId: string): Promise<{ id: string; status: string; isAlreadyDone: boolean }>;
  markDone(deploymentId: string, result: {
    category: string;
    confidence: number;
    rootCause: string;
    fixJson: Record<string, unknown>;
    source: string;
  }): Promise<void>;
  markFailed(deploymentId: string, errorReason: string): Promise<void>;
  findByDeploymentId(deploymentId: string): Promise<{ id: string; status: string } | null>;
}

export const diagnosisStore: DiagnosisStore = {
  upsertPending(deploymentId: string) {
    return new Promise((resolve, reject) => {
      grpcClient.UpsertPending({ deployment_id: deploymentId }, (err: any, response: any) => {
        if (err) {
          logger.error(`gRPC UpsertPending error for ${deploymentId}:`, err);
          return reject(err);
        }
        resolve({
          id: response.id,
          status: response.status,
          isAlreadyDone: response.is_already_done,
        });
      });
    });
  },

  markDone(deploymentId: string, result) {
    return new Promise((resolve, reject) => {
      grpcClient.MarkDone({
        deployment_id: deploymentId,
        category: result.category,
        confidence: result.confidence,
        root_cause: result.rootCause,
        fix_json: JSON.stringify(result.fixJson || {}),
        source: result.source,
      }, (err: any) => {
        if (err) {
          logger.error(`gRPC MarkDone error for ${deploymentId}:`, err);
          return reject(err);
        }
        logger.info(`Marked diagnosis as DONE via gRPC for ${deploymentId}`, { deploymentId, category: result.category });
        resolve();
      });
    });
  },

  markFailed(deploymentId: string, errorReason: string) {
    return new Promise((resolve, reject) => {
      grpcClient.MarkFailed({
        deployment_id: deploymentId,
        error_reason: errorReason,
      }, (err: any) => {
        if (err) {
          logger.error(`gRPC MarkFailed error for ${deploymentId}:`, err);
          return reject(err);
        }
        logger.warn(`Marked diagnosis as FAILED via gRPC for ${deploymentId}`, { deploymentId, errorReason });
        resolve();
      });
    });
  },

  findByDeploymentId(deploymentId: string) {
    return new Promise((resolve) => {
      grpcClient.GetDiagnosis({ deployment_id: deploymentId }, (err: any, response: any) => {
        if (err) {
          return resolve(null);
        }
        resolve({ id: response.id, status: response.status });
      });
    });
  },
};

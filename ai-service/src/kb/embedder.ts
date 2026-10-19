import { logger } from "../logger.js";
import type { Config } from "../config.js";

/**
 * Task type for asymmetric embedding models (e.g., query vs document).
 */
export type EmbeddingTaskType = "document" | "query";

/**
 * Common Embedder interface for Phase 3.
 */
export interface Embedder {
  /** Model identifier string (e.g., "Xenova/all-MiniLM-L6-v2") */
  readonly model: string;
  /** Fixed embedding vector dimension (e.g., 384) */
  readonly dimension: number;

  /**
   * Embed an array of text strings into vector representations.
   *
   * @param texts List of strings to embed
   * @param taskType Whether the embedding is for stored documents or search queries
   * @returns Array of vectors matching input texts in order
   */
  embed(texts: string[], taskType?: EmbeddingTaskType): Promise<number[][]>;
}

/**
 * Mock embedder for fast, deterministic unit tests.
 * Produces reproducible unit-normalized vectors without network or heavy models.
 */
export class MockEmbedder implements Embedder {
  readonly model = "mock-embedder";
  readonly dimension: number;

  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  async embed(texts: string[], _taskType?: EmbeddingTaskType): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array<number>(this.dimension).fill(0);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      for (let j = 0; j < this.dimension; j++) {
        vec[j] = Math.sin(hash + j);
      }
      // Normalize to unit length (L2 norm)
      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
      return vec.map((v) => v / norm);
    });
  }
}

/**
 * Local Transformers.js embedder using ONNX runtime under Node.js.
 * Defaults to Xenova/all-MiniLM-L6-v2 (384 dimensions).
 */
export class LocalTransformersEmbedder implements Embedder {
  readonly model: string;
  readonly dimension: number;
  private pipePromise: Promise<any> | null = null;

  constructor(model = "Xenova/all-MiniLM-L6-v2", dimension = 384) {
    this.model = model;
    this.dimension = dimension;
  }

  private async getPipeline(): Promise<any> {
    if (!this.pipePromise) {
      this.pipePromise = (async () => {
        const { pipeline, env } = await import("@xenova/transformers");
        // Disable telemetry/warnings
        env.allowLocalModels = false;
        logger.info("Initializing local embedding model", { model: this.model });
        return await pipeline("feature-extraction", this.model, {
          quantized: true,
        });
      })();
    }
    return this.pipePromise;
  }

  async embed(texts: string[], _taskType?: EmbeddingTaskType): Promise<number[][]> {
    if (texts.length === 0) return [];

    const pipe = await this.getPipeline();
    const results: number[][] = [];
    const batchSize = 16;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      for (const text of batch) {
        // Compute pooled, normalized embeddings
        const output = await pipe(text, {
          pooling: "mean",
          normalize: true,
        });
        const vector = Array.from(output.data as Float32Array).slice(0, this.dimension);
        if (vector.length !== this.dimension) {
          throw new Error(
            `Embedding dimension mismatch: expected ${this.dimension}, got ${vector.length}`
          );
        }
        results.push(vector as number[]);
      }
    }

    return results;
  }
}

/**
 * Factory to instantiate the appropriate embedder based on service configuration.
 */
export function createEmbedder(cfg: Config): Embedder {
  switch (cfg.EMBEDDING_PROVIDER) {
    case "mock":
      return new MockEmbedder(cfg.EMBEDDING_DIM);
    case "local":
      return new LocalTransformersEmbedder(cfg.EMBEDDING_MODEL, cfg.EMBEDDING_DIM);
    default:
      logger.warn(`Unknown embedding provider "${cfg.EMBEDDING_PROVIDER}", falling back to local embedder`);
      return new LocalTransformersEmbedder(cfg.EMBEDDING_MODEL, cfg.EMBEDDING_DIM);
  }
}

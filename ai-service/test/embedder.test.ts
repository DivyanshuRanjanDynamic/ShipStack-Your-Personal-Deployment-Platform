import { describe, it, expect } from "vitest";
import { MockEmbedder } from "../src/kb/embedder.js";

describe("Embedder Interface & MockEmbedder", () => {
  it("produces deterministic vectors of configured dimension", async () => {
    const embedder = new MockEmbedder(384);
    expect(embedder.dimension).toBe(384);
    expect(embedder.model).toBe("mock-embedder");

    const texts = ["first text", "second text", "first text"];
    const vectors = await embedder.embed(texts);

    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toHaveLength(384);
    expect(vectors[1]).toHaveLength(384);

    // Identical texts must produce identical vectors
    expect(vectors[0]).toEqual(vectors[2]);

    // Distinct texts must produce distinct vectors
    expect(vectors[0]).not.toEqual(vectors[1]);

    // Vector must have unit norm (approx 1)
    const norm = Math.sqrt(vectors[0].reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it("handles empty arrays gracefully", async () => {
    const embedder = new MockEmbedder(384);
    const vectors = await embedder.embed([]);
    expect(vectors).toEqual([]);
  });
});

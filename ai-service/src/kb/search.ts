import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { createEmbedder } from "./embedder.js";
import { query, closeDbPool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);

/**
 * Maximum cosine distance for vector candidates (similarity >= 0.28).
 * Kept as a documented constant; not env-configurable because changing it
 * requires understanding the embedding model's similarity distribution.
 */
export const VECTOR_DISTANCE_CEILING = 0.72;

export interface SearchResult {
  id: string;
  category: string;
  title: string;
  vectorRank?: number;
  vectorScore?: number;
  keywordRank?: number;
  keywordScore?: number;
  rrfScore: number;
}

export async function hybridSearch(queryString: string, topK?: number): Promise<SearchResult[]> {
  const embedder = createEmbedder(config);
  const [queryVec] = await embedder.embed([queryString], "query");
  const vectorLiteral = `[${queryVec.join(",")}]`;

  const candidatesLimit = config.RAG_CANDIDATES || 20;
  const rrfK = config.RRF_K || 60;
  const minScore = config.RAG_MIN_SCORE ?? 0.015;
  const effectiveTopK = topK ?? config.RAG_TOP_K ?? 5;

  // 1. Vector Search Candidates (cosine distance <= VECTOR_DISTANCE_CEILING)
  const vectorRes = await query<{ id: string; category: string; title: string; score: number }>(
    `SELECT c.id, c.category, d.title, 1 - (c.embedding <=> $1::vector) as score
     FROM "KbChunk" c
     JOIN "KbDocument" d ON c.document_id = d.id
     WHERE c.active = true AND c.embedding IS NOT NULL
       AND (c.embedding <=> $1::vector) <= $2
     ORDER BY c.embedding <=> $1::vector ASC
     LIMIT $3`,
    [vectorLiteral, VECTOR_DISTANCE_CEILING, candidatesLimit]
  );

  // 2. Keyword Search Candidates (using 'simple' tsquery)
  // Clean alphanumeric tokens from query string to form safe tsquery tokens
  const cleanTokens = queryString
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  let keywordRes: { rows: Array<{ id: string; category: string; title: string; score: number }> } = { rows: [] };
  if (cleanTokens.length > 0) {
    const tsQueryString = cleanTokens.slice(0, 8).join(" | ");
    keywordRes = await query<{ id: string; category: string; title: string; score: number }>(
      `SELECT c.id, c.category, d.title, ts_rank(c.tsv, to_tsquery('simple', $1)) as score
       FROM "KbChunk" c
       JOIN "KbDocument" d ON c.document_id = d.id
       WHERE c.active = true AND c.tsv @@ to_tsquery('simple', $1)
       ORDER BY score DESC
       LIMIT $2`,
      [tsQueryString, candidatesLimit]
    );
  }

  // 3. Reciprocal Rank Fusion (RRF)
  const merged = new Map<string, SearchResult>();

  vectorRes.rows.forEach((row, idx) => {
    const rank = idx + 1;
    const rrfScore = 1 / (rrfK + rank);
    merged.set(row.id, {
      id: row.id,
      category: row.category,
      title: row.title,
      vectorRank: rank,
      vectorScore: parseFloat(row.score.toFixed(4)),
      rrfScore,
    });
  });

  keywordRes.rows.forEach((row, idx) => {
    const rank = idx + 1;
    const rrfScore = 1 / (rrfK + rank);
    const existing = merged.get(row.id);
    if (existing) {
      existing.keywordRank = rank;
      existing.keywordScore = parseFloat(row.score.toFixed(4));
      existing.rrfScore += rrfScore;
    } else {
      merged.set(row.id, {
        id: row.id,
        category: row.category,
        title: row.title,
        keywordRank: rank,
        keywordScore: parseFloat(row.score.toFixed(4)),
        rrfScore,
      });
    }
  });

  // 4. Sort by combined RRF score descending, apply min-score threshold, and return top K
  return Array.from(merged.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .filter((r) => r.rrfScore >= minScore)
    .slice(0, effectiveTopK);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const userQuery = process.argv[2] || "npm ERR! ERESOLVE could not resolve dependency";
  console.log(`Searching knowledge base for: "${userQuery}"...`);
  console.log(`Config: RAG_CANDIDATES=${config.RAG_CANDIDATES}, RRF_K=${config.RRF_K}, RAG_MIN_SCORE=${config.RAG_MIN_SCORE}, RAG_TOP_K=${config.RAG_TOP_K}`);

  hybridSearch(userQuery)
    .then((results) => {
      console.log("==================================================");
      console.log("Top Search Results (RRF Hybrid Search)");
      console.log("==================================================");
      results.forEach((r, idx) => {
        console.log(`#${idx + 1} [Score: ${r.rrfScore.toFixed(5)}] ${r.id} (${r.category})`);
        console.log(`    Title:   ${r.title}`);
        console.log(`    Vector:  rank ${r.vectorRank ?? "-"} (sim: ${r.vectorScore ?? "-"})`);
        console.log(`    Keyword: rank ${r.keywordRank ?? "-"} (score: ${r.keywordScore ?? "-"})`);
        console.log("");
      });
      return closeDbPool();
    })
    .catch(async (err) => {
      console.error("Search failed:", err);
      await closeDbPool();
      process.exit(1);
    });
}

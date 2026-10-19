import { config } from "../config.js";
import { logger } from "../logger.js";
import { createEmbedder } from "../kb/embedder.js";
import { query } from "../kb/db.js";
import { VECTOR_DISTANCE_CEILING } from "../kb/search.js";
import type { RulesResult, RetrieveResult, RetrievedChunk } from "./types.js";

/**
 * Builds semantic natural language and keyword queries from the preprocessed signature and build context.
 */
export function buildRetrievalQueries(rulesResult: RulesResult): {
  vectorQuery: string;
  keywordTokens: string[];
} {
  const prep = rulesResult.signature.preprocess;
  const req = prep.request;
  const buildContext = prep.buildContext || {};

  // Extract detected framework / package manager
  const framework = typeof buildContext.framework === "string" ? buildContext.framework : "";
  const packageManager = typeof buildContext.packageManager === "string" ? buildContext.packageManager : "";

  // Prioritize specific actionable error lines over generic failure wrappers (e.g. "Failed to compile.")
  const specificErrorLine = prep.cleanedLogs.find(
    (l) =>
      /eresolve|cannot find module|can't resolve|failed to resolve|not found|unsupported engine|out of memory|fatal error|type error|syntaxerror/i.test(l)
  );
  const errorLine = specificErrorLine || prep.cleanedLogs.find(
    (l) => /error|failed|err!|exception/i.test(l)
  ) || prep.cleanedLogs[prep.cleanedLogs.length - 1] || "";

  // Category hint from best rule match
  const categoryHint = rulesResult.bestMatch ? rulesResult.bestMatch.category : "";

  // 1. Natural Language Vector Query
  const vectorParts = [
    framework ? `[${framework}]` : "",
    packageManager ? `[${packageManager}]` : "",
    categoryHint ? `Category: ${categoryHint}` : "",
    req.failed_step ? `Failed step: ${req.failed_step}` : "",
    errorLine,
  ].filter(Boolean);

  const vectorQuery = vectorParts.join(" ");

  // 2. Exact Keyword Tokens for tsquery
  // Extract error codes (e.g. ERESOLVE, EBADENGINE), package names, file basenames
  const tokens = new Set<string>();

  // Known error codes or patterns
  const codeMatches = errorLine.match(/\b([A-Z0-9_]{3,20}|@?[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+\.(?:jsx?|tsx?|json|vue|svelte))\b/g);
  if (codeMatches) {
    for (const match of codeMatches) {
      const cleanToken = match.replace(/^[^\w]+|[^\w]+$/g, "");
      if (cleanToken.length >= 3 && !/^(true|false|null|undefined|this|that|from|with|error)$/i.test(cleanToken)) {
        tokens.add(cleanToken);
      }
    }
  }

  // Also include key failure terms
  if (/eresolve/i.test(errorLine)) tokens.add("ERESOLVE");
  if (/peer dependency/i.test(errorLine)) tokens.add("peer");
  if (/cannot find module|failed to resolve|can't resolve/i.test(errorLine)) tokens.add("resolve");

  return {
    vectorQuery: vectorQuery || "deployment build failure",
    keywordTokens: Array.from(tokens),
  };
}

/**
 * Step 5: Hybrid retrieval (RAG) with reciprocal rank fusion (RRF) and framework filtering.
 */
export async function retrieveContext(
  rulesResult: RulesResult,
  options?: { topK?: number; minScore?: number; enabled?: boolean }
): Promise<RetrieveResult> {
  const startTime = Date.now();
  const isEnabled = options?.enabled ?? config.RAG_ENABLED;

  if (!isEnabled) {
    logger.info("RAG is disabled, skipping retrieval", { step: "retrieve" });
    return {
      retrievedDocs: [],
      rules: rulesResult,
      durationMs: 0,
    };
  }

  logger.info("[PIPELINE: 5/6] retrieve start (hybrid pgvector + tsvector)", {
    step: "retrieve",
  });

  try {
    const { vectorQuery, keywordTokens } = buildRetrievalQueries(rulesResult);
    const buildContext = rulesResult.signature.preprocess.buildContext || {};
    const detectedFramework = typeof buildContext.framework === "string" ? buildContext.framework.toLowerCase() : "";

    const embedder = createEmbedder(config);
    const [queryVec] = await embedder.embed([vectorQuery], "query");
    const vectorLiteral = `[${queryVec.join(",")}]`;

    const candidatesLimit = config.RAG_CANDIDATES || 20;

    // 1. Vector Search Query with relevance distance threshold (cosine similarity >= 0.28)
    const vectorRes = await query<{
      id: string;
      document_id: string;
      category: string;
      title: string;
      source_url: string | null;
      embed_text: string;
      content: string;
      framework: string[];
      package_manager: string[];
      error_signatures: string[];
      distance: number;
    }>(
      `SELECT c.id, c.document_id, c.category, d.title, d.source_url, c.embed_text, c.content,
              c.framework, c.package_manager, c.error_signatures,
              (c.embedding <=> $1::vector) as distance
       FROM "KbChunk" c
       JOIN "KbDocument" d ON c.document_id = d.id
       WHERE c.active = true AND c.embedding IS NOT NULL
         AND (c.embedding <=> $1::vector) <= $2
       ORDER BY c.embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorLiteral, VECTOR_DISTANCE_CEILING, candidatesLimit]
    );

    // 2. Keyword Full-Text Search Query (using 'simple' text config)
    let keywordRes: { rows: typeof vectorRes.rows } = { rows: [] };
    if (keywordTokens.length > 0) {
      // Escape and join alphanumeric tokens with OR '|' to avoid syntax errors in to_tsquery
      const tsQuery = keywordTokens
        .map((t) => t.replace(/[^\w]/g, ""))
        .filter((t) => t.length > 0)
        .slice(0, 8)
        .join(" | ");

      if (tsQuery.length > 0) {
        keywordRes = await query<any>(
          `SELECT c.id, c.document_id, c.category, d.title, d.source_url, c.embed_text, c.content,
                  c.framework, c.package_manager, c.error_signatures,
                  ts_rank(c.tsv, to_tsquery('simple', $1)) as rank_score
           FROM "KbChunk" c
           JOIN "KbDocument" d ON c.document_id = d.id
           WHERE c.active = true AND c.tsv @@ to_tsquery('simple', $1)
           ORDER BY rank_score DESC
           LIMIT $2`,
          [tsQuery, candidatesLimit]
        );
      }
    }

    // 3. Reciprocal Rank Fusion (RRF with k = 60)
    const RRF_K = config.RRF_K || 60;
    const candidates = new Map<string, RetrievedChunk>();

    // Add vector candidates
    vectorRes.rows.forEach((row, idx) => {
      const rank = idx + 1;
      const rrfScore = 1 / (RRF_K + rank);
      candidates.set(row.id, {
        id: row.id,
        documentId: row.document_id,
        category: row.category,
        title: row.title,
        sourceUrl: row.source_url,
        embedText: row.embed_text,
        content: row.content,
        framework: row.framework || [],
        packageManager: row.package_manager || [],
        errorSignatures: row.error_signatures || [],
        score: rrfScore,
        vectorRank: rank,
      });
    });

    // Merge keyword candidates
    keywordRes.rows.forEach((row, idx) => {
      const rank = idx + 1;
      const rrfScore = 1 / (RRF_K + rank);
      const existing = candidates.get(row.id);
      if (existing) {
        existing.keywordRank = rank;
        existing.score += rrfScore;
      } else {
        candidates.set(row.id, {
          id: row.id,
          documentId: row.document_id,
          category: row.category,
          title: row.title,
          sourceUrl: row.source_url,
          embedText: row.embed_text,
          content: row.content,
          framework: row.framework || [],
          packageManager: row.package_manager || [],
          errorSignatures: row.error_signatures || [],
          score: rrfScore,
          keywordRank: rank,
        });
      }
    });

    // 4. Framework Filtering & Soft Category Boost
    const filteredChunks: RetrievedChunk[] = [];
    const ruleCategoryHint = rulesResult.bestMatch?.category;

    for (const chunk of candidates.values()) {
      // Framework filtering: keep if chunk framework is empty (generic) OR includes detected framework
      if (detectedFramework && chunk.framework.length > 0) {
        const matchesFramework = chunk.framework.some(
          (f) => f.toLowerCase() === detectedFramework
        );
        if (!matchesFramework) {
          continue; // Filter out incompatible framework chunks
        }
      }

      // Soft category boost: 15% boost if matching rule heuristic, never a hard filter
      if (ruleCategoryHint && chunk.category === ruleCategoryHint) {
        chunk.score *= 1.15;
      }

      filteredChunks.push(chunk);
    }

    // 5. Sort by score descending and apply threshold
    const topK = options?.topK ?? config.RAG_TOP_K ?? 5;
    const minScore = options?.minScore ?? config.RAG_MIN_SCORE ?? 0.01;

    const ranked = filteredChunks
      .sort((a, b) => b.score - a.score)
      .filter((c) => c.score >= minScore)
      .slice(0, topK);

    const durationMs = Date.now() - startTime;
    logger.info("[PIPELINE: 5/6] retrieve complete", {
      step: "retrieve",
      durationMs,
      docsCount: ranked.length,
      topChunkId: ranked[0]?.id || "none",
    });

    return {
      retrievedDocs: ranked,
      rules: rulesResult,
      durationMs,
    };
  } catch (err: any) {
    logger.error("Hybrid retrieval failed, falling back to empty retrieval", err);
    return {
      retrievedDocs: [],
      rules: rulesResult,
      durationMs: Date.now() - startTime,
    };
  }
}

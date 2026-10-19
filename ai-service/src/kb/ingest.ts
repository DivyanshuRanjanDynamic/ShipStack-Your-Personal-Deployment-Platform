import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { validateKnowledgeBase, type ValidatedKbEntry } from "../../../knowledge/validate.js";
import { config } from "../config.js";
import { createEmbedder } from "./embedder.js";
import { query, closeDbPool } from "./db.js";
import { logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export interface IngestStats {
  scanned: number;
  newChunks: number;
  updatedChunks: number;
  unchangedChunks: number;
  deactivatedDocs: number;
}

export async function runIngestion(kbDirPath?: string): Promise<IngestStats> {
  const rootKnowledgeDir = kbDirPath || path.resolve(__dirname, "../../../knowledge");
  logger.info("Starting knowledge base ingestion", { rootKnowledgeDir });

  // 1. Validate all knowledge files first
  const entries: ValidatedKbEntry[] = await validateKnowledgeBase(rootKnowledgeDir);
  logger.info(`Validated ${entries.length} knowledge entries.`);

  const embedder = createEmbedder(config);
  logger.info("Using embedder", { model: embedder.model, dimension: embedder.dimension });

  // 2. Fetch all existing documents and chunks from DB (both active and inactive)
  const existingDocsRes = await query<{ id: string; path: string; content_hash: string; active: boolean }>(
    `SELECT id, path, content_hash, active FROM "KbDocument"`
  );
  const existingDocsByPath = new Map<string, { id: string; content_hash: string; active: boolean }>();
  for (const doc of existingDocsRes.rows) {
    existingDocsByPath.set(doc.path, { id: doc.id, content_hash: doc.content_hash, active: doc.active });
  }

  const existingChunksRes = await query<{ id: string; content_hash: string; active: boolean }>(
    `SELECT id, content_hash, active FROM "KbChunk"`
  );
  const existingChunksById = new Map<string, { content_hash: string; active: boolean }>();
  for (const chunk of existingChunksRes.rows) {
    existingChunksById.set(chunk.id, { content_hash: chunk.content_hash, active: chunk.active });
  }

  const activePaths = new Set<string>();
  let newChunks = 0;
  let updatedChunks = 0;
  let unchangedChunks = 0;

  // 3. Separate entries into unchanged vs needs-embedding
  interface PendingEntry {
    entry: ValidatedKbEntry;
    relPath: string;
    docHash: string;
    chunkHash: string;
    chunkId: string;
    isNew: boolean;
    existingDocId: string | null;
  }
  const pendingEntries: PendingEntry[] = [];

  for (const entry of entries) {
    const relPath = path.relative(rootKnowledgeDir, entry.filePath).replace(/\\/g, "/");
    activePaths.add(relPath);

    const docHash = computeSha256(entry.rawContent);
    const chunkHash = computeSha256(entry.embedText + "\n---\n" + entry.body);
    const chunkId = entry.frontmatter.id;

    const existingDoc = existingDocsByPath.get(relPath);
    const existingChunk = existingChunksById.get(chunkId);

    const isDocUnchanged = existingDoc && existingDoc.content_hash === docHash;
    const isChunkUnchanged = existingChunk && existingChunk.content_hash === chunkHash;

    if (isDocUnchanged && isChunkUnchanged) {
      if (!existingDoc.active) {
        await query(`UPDATE "KbDocument" SET active = true, updated_at = NOW() WHERE id = $1`, [existingDoc.id]);
      }
      if (!existingChunk.active) {
        await query(`UPDATE "KbChunk" SET active = true, updated_at = NOW() WHERE id = $1`, [chunkId]);
      }
      unchangedChunks++;
      continue;
    }

    const isNew = !existingDoc || !existingChunk;
    if (isNew) {
      newChunks++;
    } else {
      updatedChunks++;
    }

    pendingEntries.push({
      entry, relPath, docHash, chunkHash, chunkId, isNew,
      existingDocId: existingDoc ? existingDoc.id : null,
    });
  }

  // 4. Batch-embed all pending entries with retry and exponential backoff (PHASE3.md §5.2)
  const vectors: number[][] = [];
  if (pendingEntries.length > 0) {
    const textsToEmbed = pendingEntries.map((p) => p.entry.embedText);
    const BATCH_SIZE = 16;
    const MAX_RETRIES = 3;

    for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
      const batch = textsToEmbed.slice(i, i + BATCH_SIZE);
      let attempt = 0;
      while (true) {
        try {
          const batchVectors = await embedder.embed(batch, "document");
          vectors.push(...batchVectors);
          break;
        } catch (err: any) {
          attempt++;
          if (attempt >= MAX_RETRIES) {
            throw new Error(
              `Embedding failed after ${MAX_RETRIES} retries for batch at index ${i}: ${err.message}`
            );
          }
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          logger.warn(`Embedding batch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delayMs}ms`, {
            batchStart: i, batchSize: batch.length, error: err.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    logger.info(`Batch-embedded ${vectors.length} chunks`, { batches: Math.ceil(textsToEmbed.length / BATCH_SIZE) });
  }

  // 5. Derive kbVersion from content fingerprint for reproducibility (PHASE3.md §6.2, §9.5)
  const allHashes = entries.map((e) => computeSha256(e.rawContent)).sort();
  const kbVersion = computeSha256(allHashes.join(":")).substring(0, 12);

  // 6. Upsert pending entries into DB
  for (let idx = 0; idx < pendingEntries.length; idx++) {
    const { entry, relPath, docHash, chunkHash, chunkId, existingDocId } = pendingEntries[idx];
    const vector = vectors[idx];
    const vectorLiteral = `[${vector.join(",")}]`;

    const sourceType = relPath.startsWith("external/") ? "EXTERNAL" : "PLAYBOOK";
    const primarySource = entry.frontmatter.sources[0];
    const sourceUrl = primarySource ? primarySource.url : null;
    const license = primarySource ? primarySource.license : null;

    const docId = existingDocId || crypto.randomUUID();
    const docUpsertRes = await query<{ id: string }>(
      `INSERT INTO "KbDocument" (id, path, title, source, source_url, license, content_hash, kb_version, active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
       ON CONFLICT (path) DO UPDATE SET
         title = EXCLUDED.title,
         source = EXCLUDED.source,
         source_url = EXCLUDED.source_url,
         license = EXCLUDED.license,
         content_hash = EXCLUDED.content_hash,
         kb_version = EXCLUDED.kb_version,
         active = true,
         updated_at = NOW()
       RETURNING id`,
      [docId, relPath, entry.frontmatter.title, sourceType, sourceUrl, license, docHash, kbVersion]
    );
    const documentId = docUpsertRes.rows[0].id;

    await query(
      `INSERT INTO "KbChunk" (
         id, document_id, category, framework, package_manager, error_signatures,
         embed_text, content, embedding, embedding_model, embedding_dim,
         content_hash, active, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9::vector, $10, $11,
         $12, true, NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         document_id = EXCLUDED.document_id,
         category = EXCLUDED.category,
         framework = EXCLUDED.framework,
         package_manager = EXCLUDED.package_manager,
         error_signatures = EXCLUDED.error_signatures,
         embed_text = EXCLUDED.embed_text,
         content = EXCLUDED.content,
         embedding = EXCLUDED.embedding,
         embedding_model = EXCLUDED.embedding_model,
         embedding_dim = EXCLUDED.embedding_dim,
         content_hash = EXCLUDED.content_hash,
         active = true,
         updated_at = NOW()`,
      [
        chunkId, documentId,
        entry.frontmatter.category, entry.frontmatter.framework,
        entry.frontmatter.packageManager, entry.frontmatter.errorSignatures,
        entry.embedText, entry.body, vectorLiteral,
        embedder.model, embedder.dimension, chunkHash,
      ]
    );
  }

  // 4. Deactivate removed documents
  let deactivatedDocs = 0;
  for (const [pathStr, docInfo] of existingDocsByPath.entries()) {
    if (!activePaths.has(pathStr)) {
      await query(`UPDATE "KbDocument" SET active = false, updated_at = NOW() WHERE id = $1`, [docInfo.id]);
      await query(`UPDATE "KbChunk" SET active = false, updated_at = NOW() WHERE document_id = $1`, [docInfo.id]);
      deactivatedDocs++;
    }
  }

  const stats: IngestStats = {
    scanned: entries.length,
    newChunks,
    updatedChunks,
    unchangedChunks,
    deactivatedDocs,
  };

  logger.info("Ingestion completed successfully", { ...stats });
  return stats;
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runIngestion()
    .then((stats) => {
      console.log("==================================================");
      console.log("Knowledge Base Ingestion Report");
      console.log("==================================================");
      console.log(`Total files scanned:   ${stats.scanned}`);
      console.log(`New chunks inserted:   ${stats.newChunks}`);
      console.log(`Updated chunks:        ${stats.updatedChunks}`);
      console.log(`Unchanged (skipped):   ${stats.unchangedChunks}`);
      console.log(`Deactivated documents: ${stats.deactivatedDocs}`);
      console.log("==================================================");
      return closeDbPool();
    })
    .catch(async (err) => {
      console.error("Ingestion failed:", err);
      await closeDbPool();
      process.exit(1);
    });
}

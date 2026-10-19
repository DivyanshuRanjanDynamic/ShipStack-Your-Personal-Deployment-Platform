import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { query, closeDbPool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);

export async function printKbStats(): Promise<void> {
  console.log("==================================================");
  console.log("ShipStack Knowledge Base Statistics");
  console.log("==================================================");

  // Total active documents and chunks
  const summaryRes = await query(`
    SELECT
      (SELECT COUNT(*) FROM "KbDocument" WHERE active = true) AS active_docs,
      (SELECT COUNT(*) FROM "KbDocument" WHERE active = false) AS inactive_docs,
      (SELECT COUNT(*) FROM "KbChunk" WHERE active = true) AS active_chunks,
      (SELECT COUNT(*) FROM "KbChunk" WHERE active = false) AS inactive_chunks,
      (SELECT COUNT(*) FROM "KbChunk" WHERE active = true AND embedding IS NULL) AS unindexed_chunks,
      (SELECT COUNT(*) FROM "KbChunk" WHERE active = true AND tsv IS NULL) AS missing_tsv
  `);
  const s = summaryRes.rows[0];
  console.log(`Active Documents:   ${s.active_docs} (Inactive: ${s.inactive_docs})`);
  console.log(`Active Chunks:      ${s.active_chunks} (Inactive: ${s.inactive_chunks})`);
  console.log(`Unindexed Chunks:   ${s.unindexed_chunks}`);
  console.log(`Missing tsvector:   ${s.missing_tsv}`);

  if (parseInt(s.unindexed_chunks) > 0) {
    console.warn("⚠ WARNING: Some active chunks have no embedding — keyword-only search will apply.");
  }
  if (parseInt(s.missing_tsv) > 0) {
    console.warn("⚠ WARNING: Some active chunks have NULL tsv — keyword search will miss them. Check the tsvector trigger.");
  }
  console.log("--------------------------------------------------");

  // By Category
  const catRes = await query(`
    SELECT COALESCE(category, 'UNASSIGNED') as category, COUNT(*) as count
    FROM "KbChunk"
    WHERE active = true
    GROUP BY category
    ORDER BY count DESC
  `);
  console.log("Chunks by Category:");
  for (const r of catRes.rows) {
    console.log(`  - ${r.category.padEnd(25)}: ${r.count}`);
  }
  console.log("--------------------------------------------------");

  // By Source Type
  const srcRes = await query(`
    SELECT d.source, COUNT(c.id) as count
    FROM "KbChunk" c
    JOIN "KbDocument" d ON c.document_id = d.id
    WHERE c.active = true
    GROUP BY d.source
    ORDER BY count DESC
  `);
  console.log("Chunks by Source:");
  for (const r of srcRes.rows) {
    console.log(`  - ${r.source.padEnd(25)}: ${r.count}`);
  }
  console.log("--------------------------------------------------");

  // Embedding Model & Dimension Consistency Check (M5)
  const expectedDim = config.EMBEDDING_DIM;
  const expectedModel = config.EMBEDDING_MODEL;

  const modelRes = await query(`
    SELECT embedding_model, embedding_dim, COUNT(*) as count
    FROM "KbChunk"
    WHERE active = true
    GROUP BY embedding_model, embedding_dim
  `);
  console.log("Embedding Verification:");
  let dimensionMismatch = false;
  for (const r of modelRes.rows) {
    const dimMatch = parseInt(r.embedding_dim) === expectedDim;
    const modelMatch = r.embedding_model === expectedModel;
    const status = dimMatch && modelMatch ? "✓" : "✗ MISMATCH";
    console.log(`  - ${r.embedding_model} (${r.embedding_dim} dim): ${r.count} chunks ${status}`);
    if (!dimMatch || !modelMatch) {
      dimensionMismatch = true;
    }
  }

  if (dimensionMismatch) {
    console.warn(
      `⚠ WARNING: Embedding dimension/model mismatch detected. Expected: ${expectedModel} (${expectedDim} dim).` +
      ` Re-run kb:ingest to re-embed stale chunks, or change EMBEDDING_MODEL/EMBEDDING_DIM in config.`
    );
  }

  // KB Version
  const versionRes = await query(`
    SELECT kb_version, COUNT(*) as count
    FROM "KbDocument"
    WHERE active = true
    GROUP BY kb_version
  `);
  console.log("--------------------------------------------------");
  console.log("KB Versions:");
  for (const r of versionRes.rows) {
    console.log(`  - ${r.kb_version}: ${r.count} docs`);
  }

  console.log("==================================================");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  printKbStats()
    .then(() => closeDbPool())
    .catch(async (err) => {
      console.error("Failed to retrieve KB stats:", err);
      await closeDbPool();
      process.exit(1);
    });
}

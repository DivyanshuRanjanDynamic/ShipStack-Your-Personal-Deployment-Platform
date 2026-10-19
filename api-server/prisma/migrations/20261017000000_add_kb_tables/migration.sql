-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable KbDocument
CREATE TABLE IF NOT EXISTS "KbDocument" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "license" TEXT,
    "content_hash" TEXT NOT NULL,
    "kb_version" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable KbChunk
CREATE TABLE IF NOT EXISTS "KbChunk" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "category" TEXT,
    "framework" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "package_manager" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error_signatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embed_text" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(384),
    "tsv" tsvector,
    "embedding_model" TEXT,
    "embedding_dim" INTEGER,
    "content_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KbChunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "KbDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Trigger to automatically maintain tsv with simple configuration
CREATE OR REPLACE FUNCTION kb_chunk_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('simple', COALESCE(NEW.embed_text, '') || ' ' || COALESCE(array_to_string(NEW.error_signatures, ' '), ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_chunk_tsv_update ON "KbChunk";
CREATE TRIGGER kb_chunk_tsv_update BEFORE INSERT OR UPDATE
    ON "KbChunk" FOR EACH ROW EXECUTE FUNCTION kb_chunk_tsv_trigger();

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KbDocument_path_key" ON "KbDocument"("path");
CREATE INDEX IF NOT EXISTS "KbChunk_category_idx" ON "KbChunk"("category");
CREATE INDEX IF NOT EXISTS "KbChunk_active_idx" ON "KbChunk"("active");
CREATE INDEX IF NOT EXISTS "KbChunk_tsv_idx" ON "KbChunk" USING GIN ("tsv");

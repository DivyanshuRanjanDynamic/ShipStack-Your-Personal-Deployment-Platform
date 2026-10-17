-- AlterTable: Add Phase 2 fields to Diagnosis
ALTER TABLE "Diagnosis" ADD COLUMN "prompt_version" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "pipeline_version" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "needs_human" BOOLEAN;

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "category" TEXT,
    "confidence" DOUBLE PRECISION,
    "root_cause" TEXT,
    "fix_json" JSONB,
    "signature_hash" VARCHAR(64),
    "source" TEXT,
    "model" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "feedback" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Diagnosis_deployment_id_key" ON "Diagnosis"("deployment_id");

-- CreateIndex
CREATE INDEX "Diagnosis_signature_hash_idx" ON "Diagnosis"("signature_hash");

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

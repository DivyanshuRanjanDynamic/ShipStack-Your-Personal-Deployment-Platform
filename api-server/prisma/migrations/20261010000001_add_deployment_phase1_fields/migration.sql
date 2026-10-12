-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN "ecs_task_arn" TEXT,
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "deadline_at" TIMESTAMP(3),
ADD COLUMN "timed_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stop_code" TEXT,
ADD COLUMN "stopped_reason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_ecs_task_arn_key" ON "Deployment"("ecs_task_arn");

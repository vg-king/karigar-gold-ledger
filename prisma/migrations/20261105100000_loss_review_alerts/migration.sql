-- AlterEnum
ALTER TYPE "AlertStatus" RENAME VALUE 'RESOLVED' TO 'REVIEWED';

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "jobId" TEXT,
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNote" TEXT;

UPDATE "Alert" SET "jobId" = (
  SELECT "id" FROM "Job" WHERE "Job"."karigarId" = "Alert"."karigarId" ORDER BY "createdAt" DESC LIMIT 1
), "dedupeKey" = "karigarId" || ':' || COALESCE("jobId", "id");

ALTER TABLE "Alert" ALTER COLUMN "jobId" SET NOT NULL,
ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "Alert_dedupeKey_key" ON "Alert"("dedupeKey");
CREATE INDEX "Alert_jobId_idx" ON "Alert"("jobId");
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

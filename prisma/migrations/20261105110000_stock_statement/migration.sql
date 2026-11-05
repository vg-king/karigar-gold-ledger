-- AlterTable
ALTER TABLE "Job" ADD COLUMN "closedAt" TIMESTAMP(3);

UPDATE "Job"
SET "closedAt" = (
  SELECT MAX("createdAt") FROM "LedgerEntry" WHERE "LedgerEntry"."jobId" = "Job"."id"
)
WHERE "status" = 'CLOSED';

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'REFINER_SEND', 'REFINER_RETURN');

-- CreateTable
CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "movementDate" TIMESTAMP(3) NOT NULL,
  "fineMg" BIGINT NOT NULL,
  "note" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockMovement_idempotencyKey_key" ON "StockMovement"("idempotencyKey");
CREATE INDEX "StockMovement_type_movementDate_idx" ON "StockMovement"("type", "movementDate");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

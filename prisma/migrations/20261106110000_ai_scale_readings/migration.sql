CREATE TYPE "AiResolution" AS ENUM ('NONE', 'USED_AI', 'KEPT_TYPED');

ALTER TABLE "LedgerEntry"
  ADD COLUMN "aiReadingMg" BIGINT,
  ADD COLUMN "aiReadingPurityBp" INTEGER,
  ADD COLUMN "aiResolution" "AiResolution" NOT NULL DEFAULT 'NONE';

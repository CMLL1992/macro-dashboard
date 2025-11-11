-- CreateRegion
CREATE TABLE "Region" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- Insert default US region
INSERT INTO "Region" ("id", "code", "name", "currency", "createdAt", "updatedAt") 
VALUES ('region_us', 'US', 'United States', 'USD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateIndicatorSourceMap
CREATE TABLE "IndicatorSourceMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicatorId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCode" TEXT,
    "baseUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "IndicatorSourceMap_indicatorId_priority_idx" ON "IndicatorSourceMap"("indicatorId", "priority");

-- CreateFreshnessPolicy
CREATE TABLE "FreshnessPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicatorId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "maxAgeDays" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FreshnessPolicy_indicatorId_key" ON "FreshnessPolicy"("indicatorId");

-- Update Indicator: add new columns with defaults
ALTER TABLE "Indicator" ADD COLUMN "regionId" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "sourceDefault" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "Indicator" ADD COLUMN "updatedAt" DATETIME;

-- Set default values for new columns
UPDATE "Indicator" SET "createdAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;

-- Migrate Indicator data: set regionId to US region and sourceDefault from source
UPDATE "Indicator" SET "regionId" = 'region_us', "sourceDefault" = COALESCE("source", 'FRED');

-- Make regionId required
-- First ensure all indicators have regionId
UPDATE "Indicator" SET "regionId" = 'region_us' WHERE "regionId" IS NULL;

-- Add foreign key constraint
-- Note: SQLite doesn't support ALTER TABLE ADD FOREIGN KEY, so we'll skip this
-- The constraint will be enforced at application level

-- Update Observation: add new columns
ALTER TABLE "Observation" ADD COLUMN "indicatorId" TEXT;
ALTER TABLE "Observation" ADD COLUMN "provider" TEXT;
ALTER TABLE "Observation" ADD COLUMN "nextReleaseAt" DATETIME;

-- Migrate Observation data
UPDATE "Observation" SET "indicatorId" = "indicator_id", "provider" = COALESCE((SELECT "source" FROM "Indicator" WHERE "Indicator"."id" = "Observation"."indicator_id"), 'FRED');

-- Make indicatorId and provider required
UPDATE "Observation" SET "indicatorId" = "indicator_id" WHERE "indicatorId" IS NULL;
UPDATE "Observation" SET "provider" = COALESCE((SELECT "source" FROM "Indicator" WHERE "Indicator"."id" = "Observation"."indicator_id"), 'FRED') WHERE "provider" IS NULL;

-- Update PostureRule: add new columns
ALTER TABLE "PostureRule" ADD COLUMN "indicatorId" TEXT;
ALTER TABLE "PostureRule" ADD COLUMN "bandsJson" TEXT;
ALTER TABLE "PostureRule" ADD COLUMN "numericMap" TEXT;
ALTER TABLE "PostureRule" ADD COLUMN "unit" TEXT;
ALTER TABLE "PostureRule" ADD COLUMN "transform" TEXT;
ALTER TABLE "PostureRule" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "PostureRule" ADD COLUMN "updatedAt" DATETIME;

-- Set default values
UPDATE "PostureRule" SET "createdAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;

-- Migrate PostureRule data
UPDATE "PostureRule" SET "indicatorId" = "indicator_id";
UPDATE "PostureRule" SET "bandsJson" = "thresholds", "numericMap" = '{"DOVISH": 1, "NEUTRAL": 0, "HAWKISH": -1}';

-- Update PostureSnapshot: add new columns
ALTER TABLE "PostureSnapshot" ADD COLUMN "indicatorId" TEXT;
ALTER TABLE "PostureSnapshot" ADD COLUMN "computedAt" DATETIME;

-- Add numericValue and copy from numeric_value
ALTER TABLE "PostureSnapshot" ADD COLUMN "numericValue" INTEGER;

-- Migrate PostureSnapshot data
UPDATE "PostureSnapshot" SET "indicatorId" = "indicator_id";
UPDATE "PostureSnapshot" SET "numericValue" = "numeric_value";
UPDATE "PostureSnapshot" SET "computedAt" = CURRENT_TIMESTAMP WHERE "computedAt" IS NULL;

-- Update MacroScore: add new columns
ALTER TABLE "MacroScore" ADD COLUMN "regionId" TEXT;
ALTER TABLE "MacroScore" ADD COLUMN "weightedScore" REAL;
ALTER TABLE "MacroScore" ADD COLUMN "riskSignal" TEXT;
ALTER TABLE "MacroScore" ADD COLUMN "breakdownJson" TEXT;
ALTER TABLE "MacroScore" ADD COLUMN "validIndicators" INTEGER;
ALTER TABLE "MacroScore" ADD COLUMN "totalIndicators" INTEGER;
ALTER TABLE "MacroScore" ADD COLUMN "computedAt" DATETIME;

-- Migrate MacroScore data
UPDATE "MacroScore" SET 
  "regionId" = 'region_us',
  "weightedScore" = "weighted_score",
  "riskSignal" = "risk_signal",
  "breakdownJson" = "details",
  "validIndicators" = 28,
  "totalIndicators" = 28,
  "computedAt" = CURRENT_TIMESTAMP WHERE "computedAt" IS NULL;

-- Update ReleaseCalendar: add new columns
ALTER TABLE "ReleaseCalendar" ADD COLUMN "indicatorId" TEXT;
ALTER TABLE "ReleaseCalendar" ADD COLUMN "ruleText" TEXT;
ALTER TABLE "ReleaseCalendar" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "ReleaseCalendar" ADD COLUMN "updatedAt" DATETIME;

-- Set default values
UPDATE "ReleaseCalendar" SET "createdAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;

-- Migrate ReleaseCalendar data
UPDATE "ReleaseCalendar" SET "indicatorId" = "indicator_id", "ruleText" = "usual_release_rule";

-- Update AssetBias: add regionId
ALTER TABLE "AssetBias" ADD COLUMN "regionId" TEXT;
ALTER TABLE "AssetBias" ADD COLUMN "createdAt" DATETIME;

-- Set default values
UPDATE "AssetBias" SET "regionId" = 'region_us', "createdAt" = CURRENT_TIMESTAMP WHERE "regionId" IS NULL OR "createdAt" IS NULL;

-- Set default regionId for AssetBias
UPDATE "AssetBias" SET "regionId" = 'region_us' WHERE "regionId" IS NULL;

-- Drop old columns (commented out for safety - uncomment after verifying migration)
-- ALTER TABLE "Indicator" DROP COLUMN "country";
-- ALTER TABLE "Indicator" DROP COLUMN "source";
-- ALTER TABLE "Observation" DROP COLUMN "indicator_id";
-- ALTER TABLE "Observation" DROP COLUMN "source_url";
-- ALTER TABLE "Observation" DROP COLUMN "released_at";
-- ALTER TABLE "Observation" DROP COLUMN "ingested_at";
-- ALTER TABLE "PostureRule" DROP COLUMN "indicator_id";
-- ALTER TABLE "PostureRule" DROP COLUMN "thresholds";
-- ALTER TABLE "PostureSnapshot" DROP COLUMN "indicator_id";
-- ALTER TABLE "PostureSnapshot" DROP COLUMN "posture";
-- ALTER TABLE "MacroScore" DROP COLUMN "weighted_score";
-- ALTER TABLE "MacroScore" DROP COLUMN "risk_signal";
-- ALTER TABLE "MacroScore" DROP COLUMN "details";
-- ALTER TABLE "ReleaseCalendar" DROP COLUMN "indicator_id";
-- ALTER TABLE "ReleaseCalendar" DROP COLUMN "usual_release_rule";


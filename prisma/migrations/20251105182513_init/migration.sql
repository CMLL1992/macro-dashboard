-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "code" TEXT,
    "weight" REAL NOT NULL,
    "importance" TEXT NOT NULL,
    "country" TEXT DEFAULT 'US'
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicator_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    "revision" BOOLEAN NOT NULL DEFAULT false,
    "source_url" TEXT NOT NULL,
    "released_at" DATETIME NOT NULL,
    "ingested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Observation_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "Indicator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReleaseCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicator_id" TEXT NOT NULL,
    "next_release_at" DATETIME,
    "usual_release_rule" TEXT NOT NULL,
    CONSTRAINT "ReleaseCalendar_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "Indicator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostureRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicator_id" TEXT NOT NULL,
    "thresholds" TEXT NOT NULL,
    CONSTRAINT "PostureRule_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "Indicator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostureSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "indicator_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "posture" TEXT NOT NULL,
    "numeric_value" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "MacroScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "weighted_score" REAL NOT NULL,
    "risk_signal" TEXT NOT NULL,
    "details" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AssetBias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "asset_symbol" TEXT NOT NULL,
    "bias" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "linked_signal_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "orgId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'reader'
);

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "meta" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Observation_indicator_id_date_key" ON "Observation"("indicator_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseCalendar_indicator_id_key" ON "ReleaseCalendar"("indicator_id");

-- CreateIndex
CREATE UNIQUE INDEX "PostureSnapshot_indicator_id_date_key" ON "PostureSnapshot"("indicator_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MacroScore_date_key" ON "MacroScore"("date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeId_key" ON "Subscription"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseKey_key_key" ON "LicenseKey"("key");

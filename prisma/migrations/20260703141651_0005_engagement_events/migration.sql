-- CreateTable
CREATE TABLE "public"."engagement_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engagement_events_targetType_targetId_idx" ON "public"."engagement_events"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "engagement_events_eventType_targetId_dedupKey_key" ON "public"."engagement_events"("eventType", "targetId", "dedupKey");


/*
  Warnings:

  - A unique constraint covering the columns `[userId,socialAccountId,postId,date,hour,metricType]` on the table `analytics_metrics` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `analytics_metrics` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."analytics_metrics_socialAccountId_postId_date_hour_metricTy_key";

-- AlterTable
ALTER TABLE "public"."analytics_metrics" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "workspaceId" DROP NOT NULL,
ALTER COLUMN "platform" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "lastActivity" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "userAgent" TEXT,
    "ip" TEXT,
    "pages" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "details" JSONB,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sessions_userId_startTime_idx" ON "public"."user_sessions"("userId", "startTime");

-- CreateIndex
CREATE INDEX "user_sessions_lastActivity_idx" ON "public"."user_sessions"("lastActivity");

-- CreateIndex
CREATE INDEX "user_actions_userId_timestamp_idx" ON "public"."user_actions"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "user_actions_actionType_timestamp_idx" ON "public"."user_actions"("actionType", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_resolved_timestamp_idx" ON "public"."alerts"("resolved", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_severity_timestamp_idx" ON "public"."alerts"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_metrics_userId_date_idx" ON "public"."analytics_metrics"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_metrics_userId_socialAccountId_postId_date_hour_m_key" ON "public"."analytics_metrics"("userId", "socialAccountId", "postId", "date", "hour", "metricType");

-- AddForeignKey
ALTER TABLE "public"."analytics_metrics" ADD CONSTRAINT "analytics_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_metrics" ADD CONSTRAINT "analytics_metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_actions" ADD CONSTRAINT "user_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

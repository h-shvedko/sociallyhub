-- AlterTable
ALTER TABLE "public"."team_invitations" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "public"."user_workspaces" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "public"."report_share_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_share_links_tokenHash_key" ON "public"."report_share_links"("tokenHash");

-- CreateIndex
CREATE INDEX "report_share_links_reportId_idx" ON "public"."report_share_links"("reportId");

-- CreateIndex
CREATE INDEX "user_workspaces_clientId_idx" ON "public"."user_workspaces"("clientId");

-- AddForeignKey
ALTER TABLE "public"."user_workspaces" ADD CONSTRAINT "user_workspaces_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_share_links" ADD CONSTRAINT "report_share_links_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."client_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_share_links" ADD CONSTRAINT "report_share_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

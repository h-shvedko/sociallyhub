-- AlterTable
ALTER TABLE "public"."assets" ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "public"."ticket_attachments" ADD COLUMN     "storageKey" TEXT;

-- CreateIndex
CREATE INDEX "assets_storageKey_idx" ON "public"."assets"("storageKey");

-- CreateIndex
CREATE INDEX "ticket_attachments_storageKey_idx" ON "public"."ticket_attachments"("storageKey");


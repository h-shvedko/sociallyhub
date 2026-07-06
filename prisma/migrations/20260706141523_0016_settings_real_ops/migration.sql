/*
  Warnings:

  - You are about to drop the `branding_configurations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."branding_configurations" DROP CONSTRAINT "branding_configurations_lastUpdatedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."branding_configurations" DROP CONSTRAINT "branding_configurations_workspaceId_fkey";

-- DropTable
DROP TABLE "public"."branding_configurations";

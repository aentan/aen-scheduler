-- AlterTable
ALTER TABLE "SlotType" ADD COLUMN "oldSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

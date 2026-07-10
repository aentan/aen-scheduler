-- Add customDomain to User
ALTER TABLE "User" ADD COLUMN "customDomain" TEXT;
CREATE UNIQUE INDEX "User_customDomain_key" ON "User"("customDomain") WHERE "customDomain" IS NOT NULL;

-- Add slug to SlotType (nullable first)
ALTER TABLE "SlotType" ADD COLUMN "slug" TEXT;

-- Generate slugs from slot type names
UPDATE "SlotType"
SET "slug" = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(trim("name"), '[^a-zA-Z0-9\s\-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
);

-- Fallback for empty slugs
UPDATE "SlotType" SET "slug" = 'meeting-' || substring("id", 1, 8) WHERE "slug" = '' OR "slug" IS NULL;

-- Handle duplicates within same user by appending part of the id
UPDATE "SlotType" s
SET "slug" = s."slug" || '-' || substring(s."id", 1, 6)
WHERE EXISTS (
  SELECT 1 FROM "SlotType" s2
  WHERE s2."userId" = s."userId" AND s2."slug" = s."slug" AND s2."id" < s."id"
);

-- Make NOT NULL and add unique constraint
ALTER TABLE "SlotType" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "SlotType_userId_slug_key" ON "SlotType"("userId", "slug");

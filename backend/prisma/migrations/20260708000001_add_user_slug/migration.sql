-- Add slug column (nullable first so we can populate)
ALTER TABLE "User" ADD COLUMN "slug" TEXT;

-- Generate slug from name: lowercase, strip non-alphanumeric (except spaces/hyphens), collapse spaces to hyphens
UPDATE "User"
SET "slug" = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(trim("name"), '[^a-zA-Z0-9\s\-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
);

-- Fallback for any empty slugs
UPDATE "User" SET "slug" = 'user-' || substring("id", 1, 8) WHERE "slug" = '' OR "slug" IS NULL;

-- Make NOT NULL and add unique index
ALTER TABLE "User" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

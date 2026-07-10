-- CreateTable GoogleAccount
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picture" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

-- Migrate existing user tokens into GoogleAccount (one primary account per user)
INSERT INTO "GoogleAccount" ("id", "userId", "googleId", "email", "name", "picture", "accessToken", "refreshToken", "tokenExpiry", "isPrimary", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "googleId",
    "email",
    "name",
    "picture",
    "accessToken",
    "refreshToken",
    "tokenExpiry",
    true,
    NOW(),
    NOW()
FROM "User";

-- Add googleAccountId to ConnectedCalendar (nullable first so we can populate it)
ALTER TABLE "ConnectedCalendar" ADD COLUMN "googleAccountId" TEXT;

-- Populate googleAccountId from the primary GoogleAccount for each user
UPDATE "ConnectedCalendar" cc
SET "googleAccountId" = ga."id"
FROM "GoogleAccount" ga
WHERE cc."userId" = ga."userId" AND ga."isPrimary" = true;

-- Make it NOT NULL now that it's populated
ALTER TABLE "ConnectedCalendar" ALTER COLUMN "googleAccountId" SET NOT NULL;

-- Drop old token columns from User
ALTER TABLE "User" DROP COLUMN "accessToken";
ALTER TABLE "User" DROP COLUMN "refreshToken";
ALTER TABLE "User" DROP COLUMN "tokenExpiry";

-- Add foreign keys
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConnectedCalendar" ADD CONSTRAINT "ConnectedCalendar_googleAccountId_fkey"
    FOREIGN KEY ("googleAccountId") REFERENCES "GoogleAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint on GoogleAccount
CREATE UNIQUE INDEX "GoogleAccount_userId_googleId_key" ON "GoogleAccount"("userId", "googleId");

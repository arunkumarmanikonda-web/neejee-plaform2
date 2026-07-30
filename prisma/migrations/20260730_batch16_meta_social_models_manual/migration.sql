DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocialProvider') THEN
    CREATE TYPE "SocialProvider" AS ENUM ('FACEBOOK', 'INSTAGRAM');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocialConnectionStatus') THEN
    CREATE TYPE "SocialConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "SocialConnection" (
  "id" TEXT NOT NULL,
  "provider" "SocialProvider" NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "displayName" TEXT,
  "metaUserName" TEXT,
  "metaUserEmail" TEXT,
  "status" "SocialConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "accessTokenEnc" TEXT,
  "tokenType" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tokenExpiresAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SocialPageConnection" (
  "id" TEXT NOT NULL,
  "socialConnectionId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "pageName" TEXT NOT NULL,
  "pageAccessTokenEnc" TEXT,
  "category" TEXT,
  "pictureUrl" TEXT,
  "tasks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "canPost" BOOLEAN NOT NULL DEFAULT false,
  "canRead" BOOLEAN NOT NULL DEFAULT true,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "linkedInstagramId" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPageConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstagramBusinessConnection" (
  "id" TEXT NOT NULL,
  "socialConnectionId" TEXT NOT NULL,
  "instagramBusinessId" TEXT NOT NULL,
  "username" TEXT,
  "name" TEXT,
  "profilePictureUrl" TEXT,
  "biography" TEXT,
  "followersCount" INTEGER,
  "mediaCount" INTEGER,
  "linkedPageId" TEXT,
  "accountType" TEXT DEFAULT 'PROFESSIONAL',
  "isPublishReady" BOOLEAN NOT NULL DEFAULT false,
  "canCommentModerate" BOOLEAN NOT NULL DEFAULT false,
  "canPublish" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstagramBusinessConnection_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialConnection_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "SocialConnection"
      ADD CONSTRAINT "SocialConnection_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialPageConnection_socialConnectionId_fkey'
  ) THEN
    ALTER TABLE "SocialPageConnection"
      ADD CONSTRAINT "SocialPageConnection_socialConnectionId_fkey"
      FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InstagramBusinessConnection_socialConnectionId_fkey'
  ) THEN
    ALTER TABLE "InstagramBusinessConnection"
      ADD CONSTRAINT "InstagramBusinessConnection_socialConnectionId_fkey"
      FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "SocialConnection_provider_providerUserId_key"
  ON "SocialConnection"("provider", "providerUserId");

CREATE INDEX IF NOT EXISTS "SocialConnection_createdByUserId_idx"
  ON "SocialConnection"("createdByUserId");

CREATE INDEX IF NOT EXISTS "SocialConnection_status_provider_idx"
  ON "SocialConnection"("status", "provider");

CREATE UNIQUE INDEX IF NOT EXISTS "SocialPageConnection_pageId_key"
  ON "SocialPageConnection"("pageId");

CREATE INDEX IF NOT EXISTS "SocialPageConnection_socialConnectionId_isPrimary_idx"
  ON "SocialPageConnection"("socialConnectionId", "isPrimary");

CREATE INDEX IF NOT EXISTS "SocialPageConnection_linkedInstagramId_idx"
  ON "SocialPageConnection"("linkedInstagramId");

CREATE UNIQUE INDEX IF NOT EXISTS "InstagramBusinessConnection_instagramBusinessId_key"
  ON "InstagramBusinessConnection"("instagramBusinessId");

CREATE INDEX IF NOT EXISTS "InstagramBusinessConnection_socialConnectionId_idx"
  ON "InstagramBusinessConnection"("socialConnectionId");

CREATE INDEX IF NOT EXISTS "InstagramBusinessConnection_linkedPageId_idx"
  ON "InstagramBusinessConnection"("linkedPageId");
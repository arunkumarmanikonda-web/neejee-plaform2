-- The application has always used these four server-only models. Create only absent tables.
-- Definitions and indexes follow the current Prisma model. Existing rows are preserved.
DO $migration$
BEGIN
  IF to_regclass('public."SocialConnection"') IS NULL THEN
    CREATE TABLE public."SocialConnection" (
        "id" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerUserId" TEXT NOT NULL,
        "displayName" TEXT,
        "username" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "accessTokenEnc" TEXT NOT NULL,
        "refreshTokenEnc" TEXT,
        "tokenType" TEXT,
        "scopes" TEXT[],
        "tokenExpiresAt" TIMESTAMP(3),
        "lastSyncedAt" TIMESTAMP(3),
        "lastError" TEXT,
        "metaUserName" TEXT,
        "metaUserEmail" TEXT,
        "createdByUserId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "SocialConnection_provider_status_idx" ON public."SocialConnection"("provider", "status");
    CREATE INDEX "SocialConnection_createdByUserId_createdAt_idx" ON public."SocialConnection"("createdByUserId", "createdAt");
    CREATE UNIQUE INDEX "SocialConnection_provider_providerUserId_key" ON public."SocialConnection"("provider", "providerUserId");
    ALTER TABLE public."SocialConnection" ADD CONSTRAINT "SocialConnection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  ALTER TABLE public."SocialConnection" ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public."SocialConnection" FROM anon, authenticated, PUBLIC;

  IF to_regclass('public."SocialPageConnection"') IS NULL THEN
    CREATE TABLE public."SocialPageConnection" (
        "id" TEXT NOT NULL,
        "socialConnectionId" TEXT NOT NULL,
        "pageId" TEXT NOT NULL,
        "pageName" TEXT NOT NULL,
        "pageAccessTokenEnc" TEXT,
        "category" TEXT,
        "pictureUrl" TEXT,
        "tasks" TEXT[],
        "canPost" BOOLEAN NOT NULL DEFAULT false,
        "canRead" BOOLEAN NOT NULL DEFAULT false,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "linkedInstagramId" TEXT,
        "lastSyncedAt" TIMESTAMP(3),
        "lastError" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "SocialPageConnection_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "SocialPageConnection_pageId_idx" ON public."SocialPageConnection"("pageId");
    CREATE UNIQUE INDEX "SocialPageConnection_socialConnectionId_pageId_key" ON public."SocialPageConnection"("socialConnectionId", "pageId");
    ALTER TABLE public."SocialPageConnection" ADD CONSTRAINT "SocialPageConnection_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES public."SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  ALTER TABLE public."SocialPageConnection" ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public."SocialPageConnection" FROM anon, authenticated, PUBLIC;

  IF to_regclass('public."InstagramBusinessConnection"') IS NULL THEN
    CREATE TABLE public."InstagramBusinessConnection" (
        "id" TEXT NOT NULL,
        "socialConnectionId" TEXT NOT NULL,
        "instagramBusinessId" TEXT NOT NULL,
        "username" TEXT,
        "name" TEXT,
        "profilePictureUrl" TEXT,
        "accountType" TEXT,
        "biography" TEXT,
        "followersCount" INTEGER,
        "mediaCount" INTEGER,
        "linkedPageId" TEXT,
        "isPublishReady" BOOLEAN NOT NULL DEFAULT false,
        "canCommentModerate" BOOLEAN NOT NULL DEFAULT false,
        "canPublish" BOOLEAN NOT NULL DEFAULT false,
        "lastSyncedAt" TIMESTAMP(3),
        "lastError" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "InstagramBusinessConnection_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "InstagramBusinessConnection_instagramBusinessId_idx" ON public."InstagramBusinessConnection"("instagramBusinessId");
    CREATE INDEX "InstagramBusinessConnection_linkedPageId_idx" ON public."InstagramBusinessConnection"("linkedPageId");
    CREATE UNIQUE INDEX "InstagramBusinessConnection_socialConnectionId_instagramBus_key" ON public."InstagramBusinessConnection"("socialConnectionId", "instagramBusinessId");
    ALTER TABLE public."InstagramBusinessConnection" ADD CONSTRAINT "InstagramBusinessConnection_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES public."SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  ALTER TABLE public."InstagramBusinessConnection" ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public."InstagramBusinessConnection" FROM anon, authenticated, PUBLIC;

  IF to_regclass('public."AdminAiTask"') IS NULL THEN
    CREATE TABLE public."AdminAiTask" (
        "id" TEXT NOT NULL,
        "surface" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'QUEUED',
        "title" TEXT,
        "input" JSONB,
        "output" JSONB,
        "error" TEXT,
        "createdByUserId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "AdminAiTask_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "AdminAiTask_surface_action_createdAt_idx" ON public."AdminAiTask"("surface", "action", "createdAt");
    CREATE INDEX "AdminAiTask_createdByUserId_createdAt_idx" ON public."AdminAiTask"("createdByUserId", "createdAt");
    CREATE INDEX "AdminAiTask_status_createdAt_idx" ON public."AdminAiTask"("status", "createdAt");
    ALTER TABLE public."AdminAiTask" ADD CONSTRAINT "AdminAiTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  ALTER TABLE public."AdminAiTask" ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public."AdminAiTask" FROM anon, authenticated, PUBLIC;

END $migration$;

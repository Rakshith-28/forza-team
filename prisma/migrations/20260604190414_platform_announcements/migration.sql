-- CreateTable
CREATE TABLE "platform_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'INFO',
    "audience_scope" VARCHAR(30) NOT NULL DEFAULT 'ALL_CLUBS',
    "audience_roles" TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "scheduled_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_announcement_clubs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform_announcement_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,

    CONSTRAINT "platform_announcement_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_announcement_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform_announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "dismissed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_announcement_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'INFO',
    "default_audience_scope" VARCHAR(30) NOT NULL DEFAULT 'ALL_CLUBS',
    "default_audience_roles" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_announcement_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_announcements_status_idx" ON "platform_announcements"("status");

-- CreateIndex
CREATE INDEX "platform_announcements_published_at_idx" ON "platform_announcements"("published_at" DESC);

-- CreateIndex
CREATE INDEX "platform_announcements_scheduled_at_idx" ON "platform_announcements"("scheduled_at");

-- CreateIndex
CREATE INDEX "platform_announcement_clubs_club_id_idx" ON "platform_announcement_clubs"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_announcement_clubs_platform_announcement_id_club_i_key" ON "platform_announcement_clubs"("platform_announcement_id", "club_id");

-- CreateIndex
CREATE INDEX "platform_announcement_reads_user_id_idx" ON "platform_announcement_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_announcement_reads_platform_announcement_id_user_i_key" ON "platform_announcement_reads"("platform_announcement_id", "user_id");

-- AddForeignKey
ALTER TABLE "platform_announcement_clubs" ADD CONSTRAINT "platform_announcement_clubs_platform_announcement_id_fkey" FOREIGN KEY ("platform_announcement_id") REFERENCES "platform_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_announcement_clubs" ADD CONSTRAINT "platform_announcement_clubs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_announcement_reads" ADD CONSTRAINT "platform_announcement_reads_platform_announcement_id_fkey" FOREIGN KEY ("platform_announcement_id") REFERENCES "platform_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

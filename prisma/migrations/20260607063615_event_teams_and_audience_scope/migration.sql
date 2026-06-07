-- AlterTable
ALTER TABLE "events" ADD COLUMN     "audience_scope" VARCHAR(20) NOT NULL DEFAULT 'TEAMS';

-- Enforce the audience_scope string enum at the DB level (app also validates).
ALTER TABLE "events" ADD CONSTRAINT "events_audience_scope_check" CHECK ("audience_scope" IN ('CLUB_WIDE', 'TEAMS'));

-- CreateTable
CREATE TABLE "event_teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,

    CONSTRAINT "event_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_teams_event_id_idx" ON "event_teams"("event_id");

-- CreateIndex
CREATE INDEX "event_teams_team_id_idx" ON "event_teams"("team_id");

-- CreateIndex
CREATE INDEX "event_teams_club_id_idx" ON "event_teams"("club_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_teams_event_id_team_id_key" ON "event_teams"("event_id", "team_id");

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data backfill: migrate the deprecated events.team_id onto the canonical
-- audience model (audience_scope + event_teams). Idempotent.
--   * team_id IS NULL      -> CLUB_WIDE (no event_teams rows)
--   * team_id IS NOT NULL  -> TEAMS + exactly one event_teams row
-- ---------------------------------------------------------------------------
UPDATE "events" SET "audience_scope" = 'CLUB_WIDE' WHERE "team_id" IS NULL;
UPDATE "events" SET "audience_scope" = 'TEAMS' WHERE "team_id" IS NOT NULL;

INSERT INTO "event_teams" ("club_id", "event_id", "team_id")
SELECT "club_id", "id", "team_id"
FROM "events"
WHERE "team_id" IS NOT NULL
ON CONFLICT ("event_id", "team_id") DO NOTHING;

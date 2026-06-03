-- Phase 5 Step 0: additive ownership edges on files (no backfill).
-- Enables first-class TEAM_DOCUMENT (team_id) and a direct player-photo FK
-- (player_id), replacing the Phase 4 photoUrl LIKE reverse-lookup.

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "team_id" UUID,
ADD COLUMN     "player_id" UUID;

-- CreateIndex
CREATE INDEX "files_team_id_idx" ON "files"("team_id");

-- CreateIndex
CREATE INDEX "files_player_id_idx" ON "files"("player_id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

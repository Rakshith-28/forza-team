-- CreateTable
CREATE TABLE "player_remarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "parent_visible" BOOLEAN NOT NULL DEFAULT false,
    "shared_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "player_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_remarks_club_id_idx" ON "player_remarks"("club_id");

-- CreateIndex
CREATE INDEX "player_remarks_player_id_idx" ON "player_remarks"("player_id");

-- AddForeignKey
ALTER TABLE "player_remarks" ADD CONSTRAINT "player_remarks_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_remarks" ADD CONSTRAINT "player_remarks_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

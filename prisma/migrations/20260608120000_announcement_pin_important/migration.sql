-- AlterTable
ALTER TABLE "announcements"
  ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "important" BOOLEAN NOT NULL DEFAULT false;

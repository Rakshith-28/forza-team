-- Player/parent app appearance preference. Additive, NOT NULL with a default so
-- existing users adopt Classic. Console roles ignore it.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "appearance_theme" VARCHAR(20) NOT NULL DEFAULT 'classic';

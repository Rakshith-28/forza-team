-- Coach-side player & parent onboarding.
-- 1) Carry parent↔player link metadata on a PARENT invitation, applied on accept.
-- 2) Club toggle governing whether coaches may invite/link parents (default ON).
-- Both additive.

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN "link_metadata" JSONB;

-- AlterTable
ALTER TABLE "club_settings" ADD COLUMN "allow_coach_invite_parents" BOOLEAN NOT NULL DEFAULT true;

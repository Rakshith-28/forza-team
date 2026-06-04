-- Coach onboarding: carry an optional initial team_coaches role_type on a COACH
-- invitation so it can be applied when the invite is accepted. Additive, nullable.

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN "team_role_type" VARCHAR(50);

-- Eliminate "parent": the account is a PLAYER login that manages player profiles.
-- Data-preserving renames only (no DROP/CREATE). Roles are controlled strings
-- (no Postgres enum), so the role change is an in-place UPDATE.

-- 1) Role value PARENT -> PLAYER ----------------------------------------------
-- roles.code is unique; name is the display label. user_role_assignments
-- references roles by id (FK), so it needs no change.
UPDATE "roles" SET "code" = 'PLAYER', "name" = 'Player' WHERE "code" = 'PARENT';
-- Pending/expired invitations carry the role as a string.
UPDATE "invitations" SET "role_code" = 'PLAYER' WHERE "role_code" = 'PARENT';

-- 2) Rename the login table parents -> player_accounts ------------------------
ALTER TABLE "parents" RENAME TO "player_accounts";
ALTER TABLE "player_accounts" RENAME CONSTRAINT "parents_pkey" TO "player_accounts_pkey";
ALTER TABLE "player_accounts" RENAME CONSTRAINT "parents_club_id_fkey" TO "player_accounts_club_id_fkey";
ALTER TABLE "player_accounts" RENAME CONSTRAINT "parents_user_id_fkey" TO "player_accounts_user_id_fkey";
ALTER INDEX "parents_club_id_idx" RENAME TO "player_accounts_club_id_idx";
ALTER INDEX "parents_user_id_idx" RENAME TO "player_accounts_user_id_idx";
ALTER INDEX "parents_email_idx" RENAME TO "player_accounts_email_idx";
ALTER INDEX "parents_club_id_user_id_key" RENAME TO "player_accounts_club_id_user_id_key";

-- 3) Rename the link table player_parent_links -> player_account_links --------
ALTER TABLE "player_parent_links" RENAME TO "player_account_links";
ALTER TABLE "player_account_links" RENAME COLUMN "parent_id" TO "player_account_id";
ALTER TABLE "player_account_links" RENAME CONSTRAINT "player_parent_links_pkey" TO "player_account_links_pkey";
ALTER TABLE "player_account_links" RENAME CONSTRAINT "player_parent_links_club_id_fkey" TO "player_account_links_club_id_fkey";
ALTER TABLE "player_account_links" RENAME CONSTRAINT "player_parent_links_player_id_fkey" TO "player_account_links_player_id_fkey";
ALTER TABLE "player_account_links" RENAME CONSTRAINT "player_parent_links_parent_id_fkey" TO "player_account_links_player_account_id_fkey";
ALTER INDEX "player_parent_links_club_id_idx" RENAME TO "player_account_links_club_id_idx";
ALTER INDEX "player_parent_links_player_id_idx" RENAME TO "player_account_links_player_id_idx";
ALTER INDEX "player_parent_links_parent_id_idx" RENAME TO "player_account_links_player_account_id_idx";
ALTER INDEX "player_parent_links_player_id_parent_id_key" RENAME TO "player_account_links_player_id_player_account_id_key";

-- 4) Rename parent_* columns on other tables to their physical player names ----
ALTER TABLE "family_accounts" RENAME COLUMN "primary_parent_id" TO "primary_player_account_id";
ALTER TABLE "family_accounts" RENAME CONSTRAINT "family_accounts_primary_parent_id_fkey" TO "family_accounts_primary_player_account_id_fkey";

ALTER TABLE "invoices" RENAME COLUMN "parent_id" TO "player_account_id";
ALTER TABLE "invoices" RENAME CONSTRAINT "invoices_parent_id_fkey" TO "invoices_player_account_id_fkey";
ALTER INDEX "invoices_parent_id_idx" RENAME TO "invoices_player_account_id_idx";

ALTER TABLE "player_remarks" RENAME COLUMN "parent_visible" TO "player_visible";

ALTER TABLE "player_evaluations" RENAME COLUMN "parent_visible_notes" TO "player_visible_notes";

-- 4b) Controlled-string VALUES that embedded "parent" (validated app-side) -----
UPDATE "announcements" SET "audience_type" = 'PLAYERS_ONLY' WHERE "audience_type" = 'PARENTS_ONLY';
UPDATE "development_goals" SET "visibility" = 'PLAYER_VISIBLE' WHERE "visibility" = 'PARENT_VISIBLE';
-- Platform-announcement audience role codes are stored as text arrays.
UPDATE "platform_announcements" SET "audience_roles" = array_replace("audience_roles", 'PARENT', 'PLAYER');
UPDATE "platform_announcement_templates" SET "default_audience_roles" = array_replace("default_audience_roles", 'PARENT', 'PLAYER');

-- 5) Club-setting flags ------------------------------------------------------
ALTER TABLE "club_settings" RENAME COLUMN "allow_parent_to_parent_chat" TO "allow_player_to_player_chat";
ALTER TABLE "club_settings" RENAME COLUMN "allow_parent_child_evaluation_view" TO "allow_player_evaluation_view";
ALTER TABLE "club_settings" RENAME COLUMN "show_player_photos_to_parents" TO "show_player_photos_to_players";
ALTER TABLE "club_settings" RENAME COLUMN "allow_coach_invite_parents" TO "allow_coach_invite_players";

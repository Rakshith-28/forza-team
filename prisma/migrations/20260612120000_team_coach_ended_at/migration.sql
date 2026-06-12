-- Preserve coach assignment history: un-assignment now sets status='ENDED' and
-- records when it ended, instead of deleting the row. Additive + nullable, so
-- existing rows are untouched.
ALTER TABLE "team_coaches" ADD COLUMN "ended_at" TIMESTAMPTZ(6);

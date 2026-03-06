-- Alter the user_progress table to track when a lesson was completed
-- This allows for XP streaks, daily goals, and timeline charts in the gamified dashboard

ALTER TABLE user_progress
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update existing records to have a recent timestamp so they don't break XP calculations
UPDATE user_progress
SET completed_at = created_at
WHERE completed_at IS NULL;

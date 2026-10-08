-- Add rejected_at timestamp to candidates
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS rejected_at timestamptz DEFAULT NULL;

-- Add unique constraint on weekly_reports to prevent duplicate upserts
ALTER TABLE public.weekly_reports ADD CONSTRAINT weekly_reports_position_week_unique UNIQUE (position_id, week_start_date);
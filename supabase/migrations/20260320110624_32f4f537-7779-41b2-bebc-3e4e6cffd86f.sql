
ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS facebook_applicants integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_post_applicants integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkedin_contacted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_screens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_to_client integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_offers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason_rejected text NOT NULL DEFAULT '';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS reminder_settings jsonb NOT NULL DEFAULT '{"1h": true, "1d": true}'::jsonb;
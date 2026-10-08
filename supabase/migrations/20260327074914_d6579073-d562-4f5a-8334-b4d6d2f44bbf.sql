-- Drop the problematic view
DROP VIEW IF EXISTS public.profile_names;

-- Restore profiles SELECT (needed for name lookups across the app)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a separate secure table for google calendar tokens
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own token"
  ON public.google_calendar_tokens
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migrate existing tokens
INSERT INTO public.google_calendar_tokens (user_id, token)
  SELECT id, google_calendar_token FROM public.profiles
  WHERE google_calendar_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Clear tokens from profiles
UPDATE public.profiles SET google_calendar_token = NULL WHERE google_calendar_token IS NOT NULL;
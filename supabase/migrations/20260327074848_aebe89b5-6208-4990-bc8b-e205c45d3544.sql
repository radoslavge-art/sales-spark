-- Fix 1: Restrict notifications INSERT to own user_id only
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix 2: Restrict profiles SELECT to own row (protects google_calendar_token)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow seeing other users' names via a secure view
CREATE OR REPLACE VIEW public.profile_names AS
  SELECT id, name FROM public.profiles;

GRANT SELECT ON public.profile_names TO authenticated;
GRANT SELECT ON public.profile_names TO anon;
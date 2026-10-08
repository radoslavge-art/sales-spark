-- 1. Lock down interviews UPDATE policy to owner only
DROP POLICY IF EXISTS "Authenticated can update interviews" ON public.interviews;
CREATE POLICY "Users can update own interviews"
  ON public.interviews
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Restrict security_alerts INSERT to service_role only
DROP POLICY IF EXISTS "System can insert security alerts" ON public.security_alerts;
CREATE POLICY "Only service role can insert security alerts"
  ON public.security_alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);
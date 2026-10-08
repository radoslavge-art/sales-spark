
-- Email logging table
CREATE TABLE public.candidate_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert own emails"
  ON public.candidate_emails FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated can read emails"
  ON public.candidate_emails FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can delete own emails"
  ON public.candidate_emails FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Interview tracking table
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'scheduled',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert interviews"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated can read interviews"
  ON public.interviews FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update interviews"
  ON public.interviews FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete own interviews"
  ON public.interviews FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger for updated_at on interviews
CREATE TRIGGER set_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

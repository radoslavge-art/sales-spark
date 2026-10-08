
CREATE TABLE public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  candidates integer NOT NULL DEFAULT 0,
  interviews integer NOT NULL DEFAULT 0,
  offers integer NOT NULL DEFAULT 0,
  hires integer NOT NULL DEFAULT 0,
  rejections integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (position_id, week_start_date)
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to weekly_reports"
  ON public.weekly_reports
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

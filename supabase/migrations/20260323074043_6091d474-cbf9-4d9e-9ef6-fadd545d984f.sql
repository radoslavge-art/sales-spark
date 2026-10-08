
-- Drop old weekly_reports table (it was tied to positions via FK)
DROP TABLE IF EXISTS public.weekly_reports CASCADE;

-- Create new weekly_reports (header per week)
CREATE TABLE public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_start_date, created_by)
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to weekly_reports"
  ON public.weekly_reports FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Create weekly_report_rows (each row = one position entry)
CREATE TABLE public.weekly_report_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.weekly_reports(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  position_name text NOT NULL DEFAULT '',
  recruiter text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  fb_applicants integer NOT NULL DEFAULT 0,
  job_post integer NOT NULL DEFAULT 0,
  linkedin integer NOT NULL DEFAULT 0,
  phone_screens integer NOT NULL DEFAULT 0,
  sent_to_client integer NOT NULL DEFAULT 0,
  interviews integer NOT NULL DEFAULT 0,
  offers integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  hires integer NOT NULL DEFAULT 0,
  rejections integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_report_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access to weekly_report_rows"
  ON public.weekly_report_rows FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

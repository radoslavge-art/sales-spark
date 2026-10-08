
CREATE TABLE public.sales_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

ALTER TABLE public.sales_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales or admin can select sheets" ON public.sales_sheets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales or admin can insert sheets" ON public.sales_sheets
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales or admin can update sheets" ON public.sales_sheets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales or admin can delete sheets" ON public.sales_sheets
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE TABLE public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.sales_sheets(id) ON DELETE CASCADE,
  sort_order bigint NOT NULL DEFAULT 0,
  company text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  business_category text NOT NULL DEFAULT '',
  company_size text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  hq_country text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  jobs_bg_url text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  contact_date_1 text NOT NULL DEFAULT '',
  contact_date_2 text NOT NULL DEFAULT '',
  contact_date_3 text NOT NULL DEFAULT '',
  linkedin_contact text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  offer text NOT NULL DEFAULT '',
  offer_comment text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  salary text NOT NULL DEFAULT '',
  special_conditions text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales or admin can select leads" ON public.sales_leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales or admin can insert leads" ON public.sales_leads
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales or admin can update leads" ON public.sales_leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales or admin can delete leads" ON public.sales_leads
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

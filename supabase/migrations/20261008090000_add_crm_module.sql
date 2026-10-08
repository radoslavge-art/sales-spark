-- Sales Spark CRM module. The tables share the application's existing auth.users and user_roles model.
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  title text NOT NULL,
  value numeric(12,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiation', 'won', 'lost')),
  expected_close_date date,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  type text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'follow_up', 'note')),
  description text,
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_leads_owner_idx ON public.crm_leads(owner_id);
CREATE INDEX IF NOT EXISTS crm_leads_status_idx ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS crm_deals_owner_idx ON public.crm_deals(owner_id);
CREATE INDEX IF NOT EXISTS crm_activities_due_idx ON public.crm_activities(due_date) WHERE NOT completed;

CREATE OR REPLACE FUNCTION public.crm_is_manager_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'));
$$;

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM leads visible to owners and managers" ON public.crm_leads FOR SELECT TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.crm_is_manager_or_admin());
CREATE POLICY "CRM leads created by sales users" ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND (owner_id = auth.uid() OR public.crm_is_manager_or_admin()));
CREATE POLICY "CRM leads updated by owners and managers" ON public.crm_leads FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.crm_is_manager_or_admin()) WITH CHECK (owner_id = auth.uid() OR public.crm_is_manager_or_admin());
CREATE POLICY "CRM leads deleted by managers" ON public.crm_leads FOR DELETE TO authenticated USING (public.crm_is_manager_or_admin());

CREATE POLICY "CRM deals visible to owners and managers" ON public.crm_deals FOR SELECT TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.crm_is_manager_or_admin());
CREATE POLICY "CRM deals created by sales users" ON public.crm_deals FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND (owner_id = auth.uid() OR public.crm_is_manager_or_admin()));
CREATE POLICY "CRM deals updated by owners and managers" ON public.crm_deals FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.crm_is_manager_or_admin()) WITH CHECK (owner_id = auth.uid() OR public.crm_is_manager_or_admin());
CREATE POLICY "CRM deals deleted by managers" ON public.crm_deals FOR DELETE TO authenticated USING (public.crm_is_manager_or_admin());

CREATE POLICY "CRM activities visible to their users or managers" ON public.crm_activities FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.crm_is_manager_or_admin());
CREATE POLICY "CRM activities created by their users" ON public.crm_activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "CRM activities updated by their users or managers" ON public.crm_activities FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.crm_is_manager_or_admin()) WITH CHECK (user_id = auth.uid() OR public.crm_is_manager_or_admin());
CREATE POLICY "CRM activities deleted by their users or managers" ON public.crm_activities FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.crm_is_manager_or_admin());

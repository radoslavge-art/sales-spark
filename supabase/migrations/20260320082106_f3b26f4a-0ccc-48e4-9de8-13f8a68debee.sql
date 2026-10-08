
-- 1. Fix RLS on companies: require authenticated
DROP POLICY IF EXISTS "Allow all access to companies" ON public.companies;
CREATE POLICY "Authenticated full access to companies" ON public.companies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Fix RLS on positions: require authenticated
DROP POLICY IF EXISTS "Allow all access to positions" ON public.positions;
CREATE POLICY "Authenticated full access to positions" ON public.positions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Fix RLS on candidates: require authenticated
DROP POLICY IF EXISTS "Allow all access to candidates" ON public.candidates;
CREATE POLICY "Authenticated full access to candidates" ON public.candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Fix RLS on stages: require authenticated
DROP POLICY IF EXISTS "Allow all access to stages" ON public.stages;
CREATE POLICY "Authenticated full access to stages" ON public.stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Fix RLS on owners: require authenticated
DROP POLICY IF EXISTS "Allow all access to owners" ON public.owners;
CREATE POLICY "Authenticated full access to owners" ON public.owners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Create user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Seed admin role for existing admin user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'svilen.hristov@autsorsa.com'
ON CONFLICT DO NOTHING;


-- 1. Add created_by to companies and candidates
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2. User_roles: allow admins to manage roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Companies: replace blanket policy with granular ones
DROP POLICY IF EXISTS "Authenticated full access to companies" ON public.companies;

CREATE POLICY "Authenticated can select companies"
ON public.companies FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert companies"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update companies"
ON public.companies FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Only creator or admin can delete companies"
ON public.companies FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. Candidates: replace blanket policy with granular ones
DROP POLICY IF EXISTS "Authenticated full access to candidates" ON public.candidates;

CREATE POLICY "Authenticated can select candidates"
ON public.candidates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert candidates"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Creator or admin can update candidates"
ON public.candidates FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR created_by IS NULL)
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR created_by IS NULL);

CREATE POLICY "Creator or admin can delete candidates"
ON public.candidates FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR created_by IS NULL);


-- Fix candidates INSERT policy: enforce created_by = auth.uid()
DROP POLICY IF EXISTS "Authenticated can insert candidates" ON public.candidates;
CREATE POLICY "Authenticated can insert candidates"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- Fix candidates UPDATE policy: remove created_by IS NULL escape hatch
DROP POLICY IF EXISTS "Creator or admin can update candidates" ON public.candidates;
CREATE POLICY "Creator or admin can update candidates"
ON public.candidates FOR UPDATE TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix candidates DELETE policy: remove created_by IS NULL escape hatch
DROP POLICY IF EXISTS "Creator or admin can delete candidates" ON public.candidates;
CREATE POLICY "Creator or admin can delete candidates"
ON public.candidates FOR DELETE TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

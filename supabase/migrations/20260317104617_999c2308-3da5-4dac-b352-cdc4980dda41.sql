
CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to owners" ON public.owners FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.candidates ADD COLUMN owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL DEFAULT NULL;

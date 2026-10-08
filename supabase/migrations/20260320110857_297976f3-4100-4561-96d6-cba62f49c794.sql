
ALTER TABLE public.candidates ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.companies ALTER COLUMN created_by SET DEFAULT auth.uid();

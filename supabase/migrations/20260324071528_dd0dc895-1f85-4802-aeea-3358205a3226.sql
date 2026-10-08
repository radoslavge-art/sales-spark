
ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS column_type text DEFAULT NULL;
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS column_type text DEFAULT NULL;


ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue';
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue';

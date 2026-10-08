
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS max_cards integer DEFAULT NULL;
ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS max_cards integer DEFAULT NULL;


-- Add card_type to personal_tasks
ALTER TABLE public.personal_tasks ADD COLUMN card_type text NOT NULL DEFAULT 'candidate';

-- Add card_type to board_tasks
ALTER TABLE public.board_tasks ADD COLUMN card_type text NOT NULL DEFAULT 'candidate';

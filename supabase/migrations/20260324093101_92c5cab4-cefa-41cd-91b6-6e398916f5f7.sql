ALTER TABLE public.personal_tasks ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE public.personal_tasks ALTER COLUMN priority DROP NOT NULL;

ALTER TABLE public.board_tasks ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE public.board_tasks ALTER COLUMN priority DROP NOT NULL;

UPDATE public.personal_tasks SET priority = NULL WHERE priority = 'medium';
UPDATE public.board_tasks SET priority = NULL WHERE priority = 'medium';
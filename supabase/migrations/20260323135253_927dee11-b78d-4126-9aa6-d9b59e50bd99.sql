
ALTER TABLE public.personal_tasks ALTER COLUMN sort_order TYPE bigint;
ALTER TABLE public.personal_columns ALTER COLUMN sort_order TYPE bigint;
ALTER TABLE public.board_tasks ALTER COLUMN sort_order TYPE bigint;
ALTER TABLE public.board_columns ALTER COLUMN sort_order TYPE bigint;
ALTER TABLE public.weekly_reports ALTER COLUMN sort_order TYPE bigint;
ALTER TABLE public.weekly_report_rows ALTER COLUMN sort_order TYPE bigint;
ALTER TABLE public.stages ALTER COLUMN sort_order TYPE bigint;

ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue';
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue';

DROP POLICY IF EXISTS "Allow all access to companies" ON public.companies;
DROP POLICY IF EXISTS "Allow all access to positions" ON public.positions;
CREATE POLICY "Authenticated full access to positions" ON public.positions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to candidates" ON public.candidates;
DROP POLICY IF EXISTS "Allow all access to stages" ON public.stages;
CREATE POLICY "Authenticated full access to stages" ON public.stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all access to owners" ON public.owners;
CREATE POLICY "Authenticated full access to owners" ON public.owners FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

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

CREATE POLICY "Authenticated can select companies"
ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert companies"
ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update companies"
ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Only creator or admin can delete companies"
ON public.companies FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can select candidates"
ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candidates"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator or admin can update candidates"
ON public.candidates FOR UPDATE TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Creator or admin can delete candidates"
ON public.candidates FOR DELETE TO authenticated
USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS rejected_at timestamptz DEFAULT NULL;

CREATE TABLE public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sort_order bigint NOT NULL DEFAULT 0,
  UNIQUE(week_start_date, created_by)
);
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to weekly_reports"
  ON public.weekly_reports FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE public.weekly_report_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.weekly_reports(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  position_name text NOT NULL DEFAULT '',
  recruiter text NOT NULL DEFAULT '',
  sort_order bigint NOT NULL DEFAULT 0,
  fb_applicants integer NOT NULL DEFAULT 0,
  job_post integer NOT NULL DEFAULT 0,
  linkedin integer NOT NULL DEFAULT 0,
  phone_screens integer NOT NULL DEFAULT 0,
  sent_to_client integer NOT NULL DEFAULT 0,
  interviews integer NOT NULL DEFAULT 0,
  offers integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  hires integer NOT NULL DEFAULT 0,
  rejections integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  row_status text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_report_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to weekly_report_rows"
  ON public.weekly_report_rows FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_board_role(_user_id uuid, _board_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = _user_id)
      THEN 'owner'
    ELSE (
      SELECT role FROM public.board_members
      WHERE board_id = _board_id AND user_id = _user_id
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_board()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_board();

ALTER PUBLICATION supabase_realtime ADD TABLE public.board_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_columns;

CREATE TABLE public.board_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.board_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view board activities"
ON public.board_activities FOR SELECT TO authenticated
USING (is_board_participant(auth.uid(), board_id));
CREATE POLICY "Participants can insert board activities"
ON public.board_activities FOR INSERT TO authenticated
WITH CHECK (is_board_participant(auth.uid(), board_id) AND auth.uid() = user_id);
CREATE INDEX idx_board_activities_board_id ON public.board_activities(board_id, created_at DESC);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, '', COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(NEW.email, '');
  RETURN NEW;
END;
$$;

ALTER TABLE public.personal_tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS assigned_to text NOT NULL DEFAULT '';
ALTER TABLE public.board_tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS assigned_to text NOT NULL DEFAULT '';

ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS column_type text DEFAULT NULL;
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS column_type text DEFAULT NULL;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.stages ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.board_tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.weekly_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.weekly_report_rows ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.owners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.board_columns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.board_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.board_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.personal_columns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.personal_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.weekly_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.weekly_report_rows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS max_cards integer DEFAULT NULL;
ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS max_cards integer DEFAULT NULL;

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'candidate-attachments');
CREATE POLICY "Authenticated users can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'candidate-attachments');
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'candidate-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.candidate_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.candidate_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read comments"
ON public.candidate_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own comments"
ON public.candidate_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments"
ON public.candidate_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments"
ON public.candidate_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.candidate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.candidate_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read attachments metadata"
ON public.candidate_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert attachments metadata"
ON public.candidate_attachments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own attachments metadata"
ON public.candidate_attachments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.candidate_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.stages ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.board_columns ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.board_tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.personal_columns ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.personal_tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.candidate_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.candidate_attachments ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL, ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;


-- Storage bucket for candidate attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-attachments', 'candidate-attachments', false) ON CONFLICT DO NOTHING;

-- RLS for storage: authenticated users can upload/read/delete their own files
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'candidate-attachments');

CREATE POLICY "Authenticated users can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'candidate-attachments');

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'candidate-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Comments table
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
ON public.candidate_comments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert own comments"
ON public.candidate_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments"
ON public.candidate_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
ON public.candidate_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Attachments metadata table
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
ON public.candidate_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert attachments metadata"
ON public.candidate_attachments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own attachments metadata"
ON public.candidate_attachments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at on comments
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.candidate_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

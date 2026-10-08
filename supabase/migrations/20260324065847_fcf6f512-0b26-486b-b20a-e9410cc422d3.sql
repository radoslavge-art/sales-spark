
CREATE TABLE public.board_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.board_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view board activities"
ON public.board_activities
FOR SELECT
TO authenticated
USING (is_board_participant(auth.uid(), board_id));

CREATE POLICY "Participants can insert board activities"
ON public.board_activities
FOR INSERT
TO authenticated
WITH CHECK (is_board_participant(auth.uid(), board_id) AND auth.uid() = user_id);

CREATE INDEX idx_board_activities_board_id ON public.board_activities(board_id, created_at DESC);


-- Shared boards table
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Board members table
CREATE TABLE public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Board columns table
CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

-- Board tasks table
CREATE TABLE public.board_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  column_id uuid REFERENCES public.board_columns(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.board_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: boards - owner or member can see
CREATE POLICY "Owner can manage boards"
  ON public.boards FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Members can view shared boards"
  ON public.boards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members
      WHERE board_members.board_id = boards.id
      AND board_members.user_id = auth.uid()
    )
  );

-- RLS: board_members - owner manages, members can view
CREATE POLICY "Board owner can manage members"
  ON public.board_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE boards.id = board_members.board_id
      AND boards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE boards.id = board_members.board_id
      AND boards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Members can view board members"
  ON public.board_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = board_members.board_id
      AND bm.user_id = auth.uid()
    )
  );

-- RLS: board_columns - owner or member can manage
CREATE POLICY "Board participants can manage columns"
  ON public.board_columns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE boards.id = board_columns.board_id
      AND (boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.board_members
          WHERE board_members.board_id = boards.id
          AND board_members.user_id = auth.uid()
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE boards.id = board_columns.board_id
      AND (boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.board_members
          WHERE board_members.board_id = boards.id
          AND board_members.user_id = auth.uid()
        ))
    )
  );

-- RLS: board_tasks - owner or member can manage
CREATE POLICY "Board participants can manage tasks"
  ON public.board_tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE boards.id = board_tasks.board_id
      AND (boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.board_members
          WHERE board_members.board_id = boards.id
          AND board_members.user_id = auth.uid()
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.boards
      WHERE boards.id = board_tasks.board_id
      AND (boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.board_members
          WHERE board_members.board_id = boards.id
          AND board_members.user_id = auth.uid()
        ))
    )
  );

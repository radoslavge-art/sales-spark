
-- Create a function to get a user's role on a board
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

-- Auto-insert owner as board_member with role 'owner' on board creation
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

-- Insert owner rows for any existing boards that don't have them
INSERT INTO public.board_members (board_id, user_id, role)
SELECT b.id, b.owner_id, 'owner'
FROM public.boards b
WHERE NOT EXISTS (
  SELECT 1 FROM public.board_members bm
  WHERE bm.board_id = b.id AND bm.user_id = b.owner_id
);

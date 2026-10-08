
-- Fix RLS: Create security definer function to check board membership
-- This avoids infinite recursion when board_members policy references itself
CREATE OR REPLACE FUNCTION public.is_board_member(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE user_id = _user_id AND board_id = _board_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_board_owner(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = _board_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_board_participant(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Owner can manage boards" ON public.boards;
DROP POLICY IF EXISTS "Members can view shared boards" ON public.boards;
DROP POLICY IF EXISTS "Board owner can manage members" ON public.board_members;
DROP POLICY IF EXISTS "Members can view board members" ON public.board_members;
DROP POLICY IF EXISTS "Board participants can manage columns" ON public.board_columns;
DROP POLICY IF EXISTS "Board participants can manage tasks" ON public.board_tasks;

-- boards: owner has full access
CREATE POLICY "Owner full access to boards"
  ON public.boards FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- boards: members can view
CREATE POLICY "Members can view boards"
  ON public.boards FOR SELECT
  TO authenticated
  USING (public.is_board_member(auth.uid(), id));

-- board_members: owner can manage
CREATE POLICY "Board owner manages members"
  ON public.board_members FOR ALL
  TO authenticated
  USING (public.is_board_owner(auth.uid(), board_id))
  WITH CHECK (public.is_board_owner(auth.uid(), board_id));

-- board_members: members can view their own membership
CREATE POLICY "Users can view own memberships"
  ON public.board_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- board_columns: participants can manage
CREATE POLICY "Participants manage columns"
  ON public.board_columns FOR ALL
  TO authenticated
  USING (public.is_board_participant(auth.uid(), board_id))
  WITH CHECK (public.is_board_participant(auth.uid(), board_id));

-- board_tasks: participants can manage
CREATE POLICY "Participants manage tasks"
  ON public.board_tasks FOR ALL
  TO authenticated
  USING (public.is_board_participant(auth.uid(), board_id))
  WITH CHECK (public.is_board_participant(auth.uid(), board_id));

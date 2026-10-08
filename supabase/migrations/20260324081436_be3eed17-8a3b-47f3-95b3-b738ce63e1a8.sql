
-- Function: reject updates on soft-deleted rows
CREATE OR REPLACE FUNCTION public.prevent_update_on_deleted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Allow if the update is clearing deleted_at (i.e. restoring)
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;
  -- Block any other update on a soft-deleted row
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update a soft-deleted record. Restore it first.';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to all tables with deleted_at
CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.stages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.board_columns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.board_tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.personal_columns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.personal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.candidate_comments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

CREATE TRIGGER trg_prevent_update_deleted BEFORE UPDATE ON public.candidate_attachments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_update_on_deleted();

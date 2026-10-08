CREATE OR REPLACE FUNCTION public.sync_row_to_external()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payload jsonb;
  _operation text;
  _record jsonb;
  _old_record jsonb;
  _url text;
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  _url := _url || '/functions/v1/sync-to-external';
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    _operation := 'DELETE';
    _record := to_jsonb(OLD);
    _old_record := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    _operation := 'UPDATE';
    _record := to_jsonb(NEW);
    _old_record := to_jsonb(OLD);
  ELSE
    _operation := 'INSERT';
    _record := to_jsonb(NEW);
    _old_record := '{}'::jsonb;
  END IF;

  _payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'operation', _operation,
    'record', _record,
    'old_record', _old_record
  );

  PERFORM net.http_post(
    url := _url,
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', _service_key,
      'apikey', _service_key
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  _tables text[] := ARRAY[
    'companies', 'positions', 'stages', 'candidates', 'owners',
    'profiles', 'user_roles', 'activities', 'activity_logs',
    'board_activities', 'boards', 'board_columns', 'board_tasks',
    'board_members', 'personal_columns', 'personal_tasks',
    'candidate_attachments', 'candidate_comments', 'candidate_emails',
    'interviews', 'notifications', 'google_calendar_tokens',
    'security_alerts', 'user_sessions', 'weekly_reports',
    'weekly_report_rows', 'sales_sheets', 'sales_leads'
  ];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS sync_to_external_trigger ON public.%I', _t
    );
    EXECUTE format(
      'CREATE TRIGGER sync_to_external_trigger
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.sync_row_to_external()', _t
    );
  END LOOP;
END;
$$;
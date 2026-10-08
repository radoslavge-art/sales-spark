CREATE TABLE IF NOT EXISTS public.sync_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access sync_config"
ON public.sync_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update the sync function to read from config table
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
  SELECT value INTO _url FROM public.sync_config WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO _service_key FROM public.sync_config WHERE key = 'service_role_key' LIMIT 1;
  
  IF _url IS NULL OR _service_key IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  _url := _url || '/functions/v1/sync-to-external';

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

-- Also update trigger_full_sync
CREATE OR REPLACE FUNCTION public.trigger_full_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _url text;
  _service_key text;
BEGIN
  SELECT value INTO _url FROM public.sync_config WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO _service_key FROM public.sync_config WHERE key = 'service_role_key' LIMIT 1;
  
  _url := _url || '/functions/v1/sync-to-external';

  PERFORM net.http_post(
    url := _url,
    body := '{"table":"_","operation":"FULL_SYNC","record":{}}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', _service_key,
      'apikey', _service_key
    )
  );
END;
$$;
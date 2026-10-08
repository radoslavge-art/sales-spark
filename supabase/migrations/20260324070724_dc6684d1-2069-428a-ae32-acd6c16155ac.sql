
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

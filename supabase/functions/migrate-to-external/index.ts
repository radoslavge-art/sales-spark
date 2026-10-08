import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const tgtUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const tgtKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

    if (!tgtUrl || !tgtKey) {
      return new Response(JSON.stringify({ error: "External credentials not set" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const step = url.searchParams.get("step") || "schema";

    if (step === "schema") {
      // Execute schema SQL via pg_net or direct REST SQL endpoint
      const schemaSql = getSchemaSQL();
      
      // Use the SQL endpoint
      const resp = await fetch(`${tgtUrl}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "apikey": tgtKey,
          "Authorization": `Bearer ${tgtKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      // Since we can't run raw SQL via REST, let's split into individual DDL statements
      // and provide the SQL for manual execution
      return new Response(JSON.stringify({
        message: "Schema SQL generated. Copy this to your Supabase SQL Editor and run it.",
        sql: schemaSql,
        next_step: "After running the schema SQL, call this function with ?step=data to copy all data.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "data") {
      const srcUrl = Deno.env.get("SUPABASE_URL")!;
      const srcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const src = createClient(srcUrl, srcKey);
      const tgt = createClient(tgtUrl, tgtKey);

      // Tables in FK-safe order
      const tables = [
        "profiles", "user_roles", "owners", "companies", "stages", "positions",
        "candidates", "candidate_attachments", "candidate_comments", "candidate_emails",
        "interviews", "activities", "activity_logs", "notifications", "user_sessions",
        "security_alerts", "boards", "board_members", "board_columns", "board_tasks",
        "personal_columns", "personal_tasks", "board_activities", "google_calendar_tokens",
        "sales_sheets", "sales_leads", "weekly_reports", "weekly_report_rows",
      ];

      // First migrate auth users
      log("Migrating auth users...");
      const { data: authData } = await src.auth.admin.listUsers();
      let usersMigrated = 0;
      if (authData?.users) {
        for (const user of authData.users) {
          try {
            const { error: createErr } = await tgt.auth.admin.createUser({
              uid: user.id,
              email: user.email!,
              email_confirm: true,
              app_metadata: user.app_metadata,
              user_metadata: user.user_metadata,
            });
            if (createErr) {
              if (createErr.message?.includes("already") || createErr.message?.includes("exists")) {
                log(`  User ${user.email}: exists, skipping`);
              } else {
                log(`  User ${user.email}: ERROR - ${createErr.message}`);
              }
            } else {
              usersMigrated++;
              log(`  User ${user.email}: OK`);
            }
          } catch (e) {
            log(`  User ${user.email}: ${(e as Error).message}`);
          }
        }
      }

      const stats: Record<string, number> = {};

      for (const table of tables) {
        log(`Migrating ${table}...`);
        let allRows: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error } = await src.from(table).select("*").range(offset, offset + pageSize - 1);
          if (error) { log(`  READ ERROR: ${error.message}`); break; }
          if (!data || data.length === 0) break;
          allRows = allRows.concat(data);
          if (data.length < pageSize) break;
          offset += pageSize;
        }

        if (allRows.length === 0) {
          stats[table] = 0;
          log(`  ${table}: 0 rows`);
          continue;
        }

        let inserted = 0;
        const batchSize = 200;
        for (let i = 0; i < allRows.length; i += batchSize) {
          const batch = allRows.slice(i, i + batchSize);
          const { error: err } = await tgt.from(table).upsert(batch, { onConflict: "id" });
          if (err) {
            log(`  INSERT ERROR ${table}[${i}]: ${err.message}`);
          } else {
            inserted += batch.length;
          }
        }
        stats[table] = inserted;
        log(`  ${table}: ${inserted}/${allRows.length}`);
      }

      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      log(`\nDone! ${total} rows, ${usersMigrated} users migrated.`);

      return new Response(JSON.stringify({ success: true, stats, usersMigrated, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "users") {
      const srcUrl = Deno.env.get("SUPABASE_URL")!;
      const srcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const src = createClient(srcUrl, srcKey);
      const tgt = createClient(tgtUrl, tgtKey);

      log("Migrating auth users only...");
      const { data: authData } = await src.auth.admin.listUsers();
      let usersMigrated = 0;
      const results: any[] = [];
      if (authData?.users) {
        for (const user of authData.users) {
          try {
            const { error: createErr } = await tgt.auth.admin.createUser({
              uid: user.id,
              email: user.email!,
              email_confirm: true,
              app_metadata: user.app_metadata,
              user_metadata: user.user_metadata,
            });
            const status = createErr
              ? (createErr.message?.includes("already") ? "exists" : `error: ${createErr.message}`)
              : "created";
            results.push({ email: user.email, id: user.id, status });
            if (!createErr) usersMigrated++;
            log(`  ${user.email}: ${status}`);
          } catch (e) {
            results.push({ email: user.email, id: user.id, status: `error: ${(e as Error).message}` });
          }
        }
      }

      return new Response(JSON.stringify({ usersMigrated, results, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Use ?step=schema, ?step=users, or ?step=data" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, logs }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSchemaSQL(): string {
  return `
-- ============================================
-- FULL SCHEMA FOR ATS APPLICATION
-- Run this in Supabase SQL Editor on your external project
-- ============================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'sales');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Tables

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  google_calendar_token jsonb,
  reminder_settings jsonb NOT NULL DEFAULT '{"1d": true, "1h": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  label text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  sort_order bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text NOT NULL DEFAULT '',
  ai_summary text NOT NULL DEFAULT '',
  expected_salary text NOT NULL DEFAULT '',
  notice_period text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  stage_id uuid REFERENCES public.stages(id),
  owner_id uuid REFERENCES public.owners(id),
  position_id uuid NOT NULL REFERENCES public.positions(id),
  tags text[] NOT NULL DEFAULT '{}',
  is_rejected boolean NOT NULL DEFAULT false,
  previous_stage_id uuid REFERENCES public.stages(id),
  rejected_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.candidate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  cv_text text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.candidate_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.candidate_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  user_id uuid NOT NULL,
  subject text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled',
  notes text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'candidate',
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  content text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

CREATE TABLE IF NOT EXISTS public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id),
  label text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  column_type text,
  sort_order bigint NOT NULL DEFAULT 0,
  max_cards integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.board_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id),
  column_id uuid REFERENCES public.board_columns(id),
  candidate_id uuid REFERENCES public.candidates(id),
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  card_type text NOT NULL DEFAULT 'candidate',
  assigned_to text NOT NULL DEFAULT '',
  priority text,
  sort_order bigint NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.personal_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  column_type text,
  sort_order bigint NOT NULL DEFAULT 0,
  max_cards integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.personal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  column_id uuid REFERENCES public.personal_columns(id),
  candidate_id uuid REFERENCES public.candidates(id),
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  card_type text NOT NULL DEFAULT 'candidate',
  assigned_to text NOT NULL DEFAULT '',
  priority text,
  sort_order bigint NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.board_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id),
  user_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  user_id uuid PRIMARY KEY,
  token jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.sales_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.sales_sheets(id),
  sort_order bigint NOT NULL DEFAULT 0,
  company text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  business_category text NOT NULL DEFAULT '',
  company_size text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  hq_country text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  jobs_bg_url text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  contact_date_1 text NOT NULL DEFAULT '',
  contact_date_2 text NOT NULL DEFAULT '',
  contact_date_3 text NOT NULL DEFAULT '',
  linkedin_contact text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  offer text NOT NULL DEFAULT '',
  offer_comment text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  salary text NOT NULL DEFAULT '',
  special_conditions text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  created_by uuid NOT NULL,
  sort_order bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.weekly_report_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.weekly_reports(id),
  sort_order bigint NOT NULL DEFAULT 0,
  company_name text NOT NULL DEFAULT '',
  position_name text NOT NULL DEFAULT '',
  recruiter text NOT NULL DEFAULT '',
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
  row_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

-- 4. Security-definer functions

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_board_owner(_user_id uuid, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(_user_id uuid, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE user_id = _user_id AND board_id = _board_id)
$$;

CREATE OR REPLACE FUNCTION public.is_board_participant(_user_id uuid, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = _user_id)
  OR EXISTS (SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_board_role(_user_id uuid, _board_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.boards WHERE id = _board_id AND owner_id = _user_id) THEN 'owner'
    ELSE (SELECT role FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id LIMIT 1)
  END
$$;

-- 5. Triggers

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, '', COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(NEW.email, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_board()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_board_created ON public.boards;
CREATE TRIGGER on_board_created AFTER INSERT ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_board();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
  IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot update a soft-deleted record. Restore it first.'; END IF;
  RETURN NEW;
END;
$$;

-- 6. Enable RLS on all tables

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_rows ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- owners
CREATE POLICY "Authenticated full access to owners" ON public.owners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- companies
CREATE POLICY "Authenticated can select companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update companies" ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Only creator or admin can delete companies" ON public.companies FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- stages
CREATE POLICY "Authenticated full access to stages" ON public.stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- positions
CREATE POLICY "Authenticated full access to positions" ON public.positions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- candidates
CREATE POLICY "Authenticated can select candidates" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator or admin can update candidates" ON public.candidates FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin')) WITH CHECK ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Creator or admin can delete candidates" ON public.candidates FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- candidate_attachments
CREATE POLICY "Authenticated can read attachments metadata" ON public.candidate_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert attachments metadata" ON public.candidate_attachments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated can update own attachments metadata" ON public.candidate_attachments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own attachments metadata" ON public.candidate_attachments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- candidate_comments
CREATE POLICY "Authenticated can read comments" ON public.candidate_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own comments" ON public.candidate_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON public.candidate_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.candidate_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- candidate_emails
CREATE POLICY "Authenticated can read emails" ON public.candidate_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own emails" ON public.candidate_emails FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own emails" ON public.candidate_emails FOR DELETE TO authenticated USING (user_id = auth.uid());

-- interviews
CREATE POLICY "Authenticated can read interviews" ON public.interviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert interviews" ON public.interviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own interviews" ON public.interviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own interviews" ON public.interviews FOR DELETE TO authenticated USING (user_id = auth.uid());

-- activities
CREATE POLICY "Authenticated users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- activity_logs
CREATE POLICY "Admins can read activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- notifications
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_sessions
CREATE POLICY "Users can read own sessions" ON public.user_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.user_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all sessions" ON public.user_sessions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- security_alerts
CREATE POLICY "Admins can read security alerts" ON public.security_alerts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update security alerts" ON public.security_alerts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Only service role can insert security alerts" ON public.security_alerts FOR INSERT TO service_role WITH CHECK (true);

-- boards
CREATE POLICY "Owner full access to boards" ON public.boards FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members can view boards" ON public.boards FOR SELECT TO authenticated USING (is_board_member(auth.uid(), id));

-- board_members
CREATE POLICY "Board owner manages members" ON public.board_members FOR ALL TO authenticated USING (is_board_owner(auth.uid(), board_id)) WITH CHECK (is_board_owner(auth.uid(), board_id));
CREATE POLICY "Users can view own memberships" ON public.board_members FOR SELECT TO authenticated USING (user_id = auth.uid());

-- board_columns
CREATE POLICY "Participants manage columns" ON public.board_columns FOR ALL TO authenticated USING (is_board_participant(auth.uid(), board_id)) WITH CHECK (is_board_participant(auth.uid(), board_id));

-- board_tasks
CREATE POLICY "Participants manage tasks" ON public.board_tasks FOR ALL TO authenticated USING (is_board_participant(auth.uid(), board_id)) WITH CHECK (is_board_participant(auth.uid(), board_id));

-- personal_columns
CREATE POLICY "Users can manage own columns" ON public.personal_columns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- personal_tasks
CREATE POLICY "Users can manage own tasks" ON public.personal_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- board_activities
CREATE POLICY "Participants can view board activities" ON public.board_activities FOR SELECT TO authenticated USING (is_board_participant(auth.uid(), board_id));
CREATE POLICY "Participants can insert board activities" ON public.board_activities FOR INSERT TO authenticated WITH CHECK (is_board_participant(auth.uid(), board_id) AND auth.uid() = user_id);

-- google_calendar_tokens
CREATE POLICY "Users can manage own token" ON public.google_calendar_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sales_sheets
CREATE POLICY "Sales or admin can select sheets" ON public.sales_sheets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales or admin can insert sheets" ON public.sales_sheets FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales or admin can update sheets" ON public.sales_sheets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales or admin can delete sheets" ON public.sales_sheets FOR DELETE TO authenticated USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

-- sales_leads
CREATE POLICY "Sales or admin can select leads" ON public.sales_leads FOR SELECT TO authenticated USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales or admin can insert leads" ON public.sales_leads FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales or admin can update leads" ON public.sales_leads FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Sales or admin can delete leads" ON public.sales_leads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'sales') OR has_role(auth.uid(), 'admin'));

-- weekly_reports
CREATE POLICY "Authenticated full access to weekly_reports" ON public.weekly_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- weekly_report_rows
CREATE POLICY "Authenticated full access to weekly_report_rows" ON public.weekly_report_rows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Realtime (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;

SELECT 'Schema created successfully!' AS result;
`;
}

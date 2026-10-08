# Migration Survival Guide — Last-Mile Execution

> Companion to `README_TECHNICAL.md` and `ADVANCED_MIGRATION_GUIDE.md`. No repeated content.

---

## 1. Exact Failure Scenarios (Real Cases)

### Scenario 1: Google OAuth Redirect Loop After Migration

**Symptoms:** User clicks "Sign in with Google" → browser loops between login page and Google consent → ends on login page with no error visible. Console shows `AuthSessionMissingError` or `Invalid redirect_uri`.

**Root Cause:** The OAuth redirect URI in Google Cloud Console still points to the old Lovable domain (`*.lovable.app`) or the Lovable-managed OAuth proxy. After migration, Supabase expects `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.

**Fix:**
1. Go to Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
2. Under "Authorized redirect URIs", add: `https://<YOUR_SUPABASE_REF>.supabase.co/auth/v1/callback`
3. Under "Authorized JavaScript origins", add your frontend domain (e.g., `https://yourdomain.com`)
4. In Supabase Dashboard → Authentication → Providers → Google, paste your Client ID and Client Secret
5. Verify `GoogleSignInButton.tsx` uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` — NOT `lovable.auth.signInWithOAuth()`
6. Wait 5 minutes for Google to propagate changes before retesting

### Scenario 2: R2 Uploads Return 403 Forbidden

**Symptoms:** Uploading a CV in the candidate detail sheet fails silently. Network tab shows `POST /functions/v1/r2-storage?action=upload` returning `500` with body `{"error":"Internal server error"}`.

**Root Cause:** The `R2_ACCESS_KEY_ID` or `R2_SECRET_ACCESS_KEY` Supabase secret is wrong, or the R2 API token doesn't have `Object Read & Write` permissions on the target bucket.

**Fix:**
1. In Cloudflare Dashboard → R2 → Manage R2 API Tokens, verify the token has `Object Read & Write` on the correct bucket
2. Copy the Access Key ID and Secret Access Key exactly (no trailing whitespace)
3. In Supabase Dashboard → Edge Functions → Secrets, update `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`
4. Test with: `supabase functions invoke r2-storage --body '{"action":"upload"}' ...` or use the UI
5. Check Edge Function logs: `supabase functions logs r2-storage` — look for `R2 upload failed: 403`

### Scenario 3: New Users Can't See Any Data After Registration

**Symptoms:** User registers, confirms email, logs in → sees empty dashboard. No companies, positions, or candidates load. No errors in console.

**Root Cause:** The `handle_new_user` trigger on `auth.users` is missing. This trigger creates a row in `public.profiles`. Without a profile row, RLS policies that join on `profiles` or check `auth.uid()` against profile-based conditions silently return empty sets.

**Fix:**
1. Verify trigger exists:
```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```
2. If missing, recreate:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, '', COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(NEW.email, '');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```
3. Backfill existing users missing profiles:
```sql
INSERT INTO public.profiles (id, email)
SELECT id, COALESCE(email, '') FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```

### Scenario 4: Edge Function Deployed But Returns 500 on Every Call

**Symptoms:** All calls to any edge function return `{"error":"Internal server error"}`. Supabase Edge Function logs show `TypeError: Deno.env.get(...) is null`.

**Root Cause:** Secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are not set in the target Supabase project's Edge Function secrets.

**Fix:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add ALL required secrets:
   - `SUPABASE_URL` = `https://<ref>.supabase.co`
   - `SUPABASE_ANON_KEY` = your anon/publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   - `EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` (if using sync)
3. Redeploy edge functions after setting secrets
4. Verify with: `curl -X POST https://<ref>.supabase.co/functions/v1/<name> -H "Authorization: Bearer <anon_key>" -H "apikey: <anon_key>"`

### Scenario 5: Candidates Table RLS Blocks All Writes

**Symptoms:** Adding a candidate via the UI shows a toast "Failed to add candidate". Network tab shows `POST /rest/v1/candidates` returning `403` or row-level security violation.

**Root Cause:** RLS policies on `candidates` require `auth.uid()` to match specific conditions. If the policy references a function like `has_role()` that doesn't exist yet (wasn't migrated), PostgreSQL silently denies access.

**Fix:**
1. Verify all security-definer functions exist:
```sql
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
AND proname IN ('has_role', 'is_board_member', 'is_board_owner', 'is_board_participant', 'get_board_role');
```
2. If any are missing, recreate from the schema migration SQL
3. Verify RLS policies:
```sql
SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'candidates';
```
4. Test with a known user:
```sql
SET request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
SET role = 'authenticated';
SELECT * FROM candidates LIMIT 1;
```

### Scenario 6: Weekly Report "New" Badge Persists Forever

**Symptoms:** Companies or positions added in the weekly report keep showing the "NEW" badge across all tabs, never disappearing.

**Root Cause:** The `newEntities` Map in the WeeklyReport component stores `{ createdInReportId, currentReportIndex }`. If `reports` array order changes (e.g., due to sort_order inconsistency after migration), the index comparison `currentIdx > createdIdx + 1` fails.

**Fix:**
1. Verify `weekly_reports` table has correct `sort_order` values:
```sql
SELECT id, week_start_date, sort_order FROM weekly_reports WHERE deleted_at IS NULL ORDER BY sort_order;
```
2. Ensure no duplicate `sort_order` values exist
3. If sort_order is broken, reindex:
```sql
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY week_start_date DESC) as new_order
  FROM weekly_reports WHERE deleted_at IS NULL
)
UPDATE weekly_reports SET sort_order = ordered.new_order FROM ordered WHERE weekly_reports.id = ordered.id;
```

### Scenario 7: Sync Triggers Cause Cascade Failures

**Symptoms:** After migration, any INSERT/UPDATE/DELETE on synced tables is slow (2-5 seconds) or times out. `pg_net` queue fills up.

**Root Cause:** The `sync_row_to_external` trigger fires on every write to 28 tables. If the `sync_config` table has the old Lovable URL or the external Supabase is unreachable, `pg_net` queues grow unbounded.

**Fix:**
1. If you don't need sync in the new environment, drop all sync triggers:
```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tgname, relname FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname LIKE 'sync_%' LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END $$;
DROP TABLE IF EXISTS public.sync_config;
```
2. If you still need sync, update `sync_config` with new URLs:
```sql
UPDATE sync_config SET value = 'https://NEW_REF.supabase.co' WHERE key = 'supabase_url';
UPDATE sync_config SET value = 'NEW_SERVICE_ROLE_KEY' WHERE key = 'service_role_key';
```

### Scenario 8: PDF/DOCX CV Text Extraction Returns Empty

**Symptoms:** Uploading a CV works, but the `cv_text` column stays NULL. AI tag extraction returns empty tags. Search doesn't find candidates by CV content.

**Root Cause:** The `backfill-cv-text` edge function uses `npm:pdf-parse` and `npm:mammoth` which require specific Deno compatibility. If the edge runtime version changed, these npm imports may fail silently.

**Fix:**
1. Check edge function logs: `supabase functions logs backfill-cv-text`
2. Look for `Error: Cannot find module` or similar
3. Pin versions explicitly: `import pdfParse from "npm:pdf-parse@1.1.1"` and `import mammoth from "npm:mammoth@1.8.0"`
4. Test with a known PDF: invoke the function manually with a single attachment ID
5. If npm imports are broken in your edge runtime, consider extracting text client-side using the existing `src/lib/extractFileText.ts` (already present) and writing `cv_text` from the frontend after upload

---

## 2. Pre-Migration Checklist (GO / NO-GO)

### Accounts & Access

- [ ] Supabase account created with a project on the paid plan (free tier has edge function limits)
- [ ] Supabase project ref and all keys noted: anon key, service role key, project URL
- [ ] Cloudflare account with R2 enabled
- [ ] R2 bucket created with a descriptive name (e.g., `ats-candidate-attachments`)
- [ ] R2 API token created with `Object Read & Write` permissions scoped to the bucket
- [ ] Google Cloud project with OAuth 2.0 credentials (Client ID + Secret)
- [ ] Google OAuth consent screen configured with correct scopes (`email`, `profile`, `openid`)
- [ ] Domain/hosting ready (Vercel, Netlify, or similar) with environment variable support

### Credentials Ready

- [ ] `SUPABASE_URL` — `https://<ref>.supabase.co`
- [ ] `SUPABASE_ANON_KEY` — from Supabase dashboard → Settings → API
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — from same location (KEEP SECRET)
- [ ] `R2_ACCOUNT_ID` — from Cloudflare dashboard → R2 overview
- [ ] `R2_ACCESS_KEY_ID` — from R2 API token
- [ ] `R2_SECRET_ACCESS_KEY` — from R2 API token
- [ ] `R2_BUCKET_NAME` — the bucket name you created
- [ ] `GOOGLE_CLIENT_ID` — from Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` — from Google Cloud Console

### Data Export

- [ ] Full database dump exported from Lovable Cloud (use `migrate-to-external` edge function or `pg_dump`)
- [ ] All R2 files accounted for (run `backfill-cv-text` first to ensure cv_text is populated as fallback)
- [ ] Auth users exported (use `admin-users` edge function `GET?action=list`)
- [ ] `sync_config` table data noted (if continuing sync)

### Code Preparation

- [ ] `src/integrations/supabase/client.ts` updated to use new env vars (or env vars point to new project)
- [ ] All `import.meta.env.VITE_SUPABASE_URL` references point to new project
- [ ] `lovable.auth.signInWithOAuth` replaced with `supabase.auth.signInWithOAuth`
- [ ] `@lovable.dev/cloud-auth-js` removed from `package.json`
- [ ] `src/integrations/lovable/` directory removed
- [ ] `GoogleSignInButton.tsx` uses standard Supabase OAuth
- [ ] `.env` file created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

### Infrastructure

- [ ] Supabase storage bucket `candidate-attachments` created (private, for legacy fallback)
- [ ] RLS policies on storage bucket configured
- [ ] All edge functions deployed to new Supabase project
- [ ] All edge function secrets set in new project
- [ ] `pg_net` extension enabled (for sync triggers, if used)
- [ ] `pg_cron` extension enabled (for scheduled jobs, if used)

---

## 3. Post-Migration Verification Checklist

### Authentication (Priority 1)

```
[ ] Email/password login works
[ ] Email/password registration works (with @autsorsa.com or @anagami.bg domain)
[ ] Registration with non-allowed domain is rejected
[ ] Email verification flow completes
[ ] Google OAuth sign-in works (if enabled)
[ ] Password reset flow works end-to-end
[ ] Session persists across page refresh
[ ] Logout clears session
```

**Verification query:**
```sql
SELECT id, email, created_at, email_confirmed_at FROM auth.users ORDER BY created_at DESC LIMIT 5;
SELECT id, name, email FROM profiles ORDER BY created_at DESC LIMIT 5;
```

### Core CRUD (Priority 1)

```
[ ] Create a company → appears in list
[ ] Create a position under that company → appears in kanban
[ ] Add a candidate to that position → card shows on kanban
[ ] Move candidate between stages → stage updates
[ ] Edit candidate details (name, email, phone, salary, notes)
[ ] Soft-delete a candidate → moves to trash
[ ] Restore from trash → candidate returns
[ ] Hard-delete (purge) works
```

**Verification query:**
```sql
SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM positions WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM candidates WHERE deleted_at IS NOT NULL;
```

### File Storage (Priority 1)

```
[ ] Upload a PDF CV → file appears in attachments list
[ ] Upload a DOCX CV → file appears in attachments list
[ ] Download an uploaded file → correct file downloads
[ ] Delete an attachment → file removed from list
[ ] Upload a file with Cyrillic filename → works without error
[ ] cv_text field is populated after upload (check DB)
```

**Verification query:**
```sql
SELECT id, file_name, file_path, mime_type, upload_status, cv_text IS NOT NULL as has_text
FROM candidate_attachments WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5;
```

### Weekly Reports (Priority 2)

```
[ ] Create a new weekly report tab
[ ] Add a row with company + position
[ ] Edit numeric fields (linkedin, sent_to_client, interviews, etc.)
[ ] "NEW" badge appears on newly created company/position
[ ] "NEW" badge disappears after 2 tabs
[ ] Delete a tab → confirmation dialog appears → tab removed
[ ] Export to Excel works
```

### Boards / My Board (Priority 2)

```
[ ] Create a personal board column
[ ] Create a task card
[ ] Drag card between columns
[ ] Share a board with another user
[ ] Other user can see shared board
```

### Admin Panel (Priority 2)

```
[ ] Admin can list all users
[ ] Admin can change a user's email
[ ] Admin can toggle roles (admin/user/sales)
[ ] Admin can delete a user (not self)
[ ] Activity logs display correctly
```

### Edge Functions (Priority 2)

Test each function individually:
```
[ ] r2-storage: upload, download, signed-url, delete
[ ] extract-tags: POST with { text: "..." } returns tags
[ ] check-interview-reminders: returns { ok: true }
[ ] purge-trash: returns { purged: N }
[ ] purge-expired-attachments: returns { purged: N }
[ ] admin-users: GET?action=list returns user list
[ ] backfill-cv-text: processes attachments
[ ] find-user-by-email: returns user data
```

---

## 4. Rollback Strategy

### Before Migration: Create Safety Net

1. **Snapshot the Lovable database:**
   - Use the `sync-to-external` FULL_SYNC to ensure external Supabase has latest data
   - Take a manual `pg_dump` if possible via Supabase dashboard → Database → Backups

2. **Keep Lovable project intact:**
   - Do NOT delete or modify the Lovable project until the new environment is fully verified
   - Lovable Cloud remains the source of truth until cutover is confirmed

3. **DNS/Domain strategy:**
   - Use a subdomain for the new deployment (e.g., `new.yourdomain.com`)
   - Keep production pointing to Lovable (`ats-autsorsa.lovable.app`) until ready
   - Switch DNS only after full verification

### During Migration: Point of No Return Markers

| Phase | Reversible? | Notes |
|-------|------------|-------|
| Schema creation on new Supabase | ✅ Yes | Drop and recreate |
| Data import | ✅ Yes | Truncate and re-import |
| Auth user creation | ⚠️ Partial | Users may need to re-verify email |
| R2 file migration | ✅ Yes | Files remain in both locations |
| DNS switch | ✅ Yes | Revert DNS to old target |
| Sync trigger removal | ⚠️ Caution | Re-adding requires re-running migration SQL |
| Lovable project deletion | ❌ No | NEVER delete until 100% confirmed |

### If Migration Fails Mid-Way

1. **Frontend broken?** Revert DNS to Lovable app. Users won't notice.
2. **Database corrupt?** Drop all tables in new Supabase, re-run schema migration, re-import data.
3. **Auth broken?** Delete all users in new Supabase auth, re-run user migration.
4. **R2 broken?** R2 files are immutable during migration — the originals still exist. Re-run `migrate-storage-to-r2`.

### Safe Testing Without Breaking Production

- Deploy new frontend to a staging URL (Vercel preview, Netlify branch deploy)
- Point staging at the NEW Supabase project
- Keep production pointing at Lovable Cloud
- Test all flows on staging with test accounts
- Only switch production DNS after 48 hours of successful staging use

---

## 5. Security Gaps & Fixes

### Gap 1: Client-Side Domain Restriction on Registration

**Location:** `src/pages/Register.tsx`  
**Risk:** Registration is restricted to `@autsorsa.com` and `@anagami.bg` by checking the email domain in JavaScript before calling `supabase.auth.signUp()`. An attacker can bypass this by calling the Supabase API directly with any email.

**Fix:** Add a database trigger or Supabase auth hook:
```sql
CREATE OR REPLACE FUNCTION public.check_email_domain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@autsorsa.com' AND NEW.email NOT LIKE '%@anagami.bg' THEN
    RAISE EXCEPTION 'Registration restricted to authorized domains';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply as a Supabase Auth Hook (via dashboard) or use a custom signup edge function
```
Alternatively, disable open signups in Supabase dashboard and use invite-only.

### Gap 2: Edge Functions Without Input Validation

**Location:** `r2-storage/index.ts`, `sync-to-external/index.ts`  
**Risk:** The `path` query parameter in r2-storage is not validated. A malicious user could craft a path like `../../etc/passwd` or access another user's files by guessing paths.

**Fix:**
```typescript
// Add to r2-storage before processing
const filePath = url.searchParams.get("path");
if (!filePath || filePath.includes('..') || !filePath.match(/^[a-f0-9-]+\//)) {
  return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: corsHeaders });
}
```

### Gap 3: Permissive RLS on Candidates Table

**Risk:** All authenticated users can SELECT all candidates including PII (phone, email, salary). For a small team this is acceptable, but at scale it leaks sensitive data.

**Fix (when needed):**
```sql
-- Restrict candidate visibility to same-company users
CREATE POLICY "Users see candidates in their positions" ON candidates FOR SELECT
USING (
  position_id IN (
    SELECT id FROM positions WHERE company_id IN (
      SELECT company_id FROM positions
      JOIN candidates ON candidates.position_id = positions.id
      WHERE candidates.created_by = auth.uid()
    )
  )
);
```

### Gap 4: Service Role Key in sync_config Table

**Risk:** The `sync_config` table stores the `service_role_key` in plaintext. Any authenticated user with SELECT on this table can read it and gain full admin access to the external Supabase project.

**Fix:**
```sql
-- Verify RLS is enabled and restrictive
ALTER TABLE sync_config ENABLE ROW LEVEL SECURITY;
-- Remove any permissive SELECT policies
DROP POLICY IF EXISTS "allow_select_sync_config" ON sync_config;
-- Only allow service_role access (no user-facing policies)
```

### Gap 5: No Rate Limiting on Auth Endpoints

**Risk:** Brute-force attacks on login endpoint. Supabase has built-in rate limiting but defaults may be too generous.

**Fix:** In Supabase dashboard → Authentication → Rate Limits, set:
- Sign-in attempts: 5 per minute per IP
- Sign-up attempts: 3 per hour per IP
- Password recovery: 3 per hour per email

---

## 6. Cost Risks

### Cloudflare R2

| Action | Free Tier | Cost After |
|--------|-----------|------------|
| Storage | 10 GB/month | $0.015/GB/month |
| Class A (uploads, deletes) | 1M/month | $4.50/1M |
| Class B (downloads, reads) | 10M/month | $0.36/1M |

**Risk triggers:**
- Bulk CV upload (BulkCvUploadDialog) — 50 files × 2MB = 100MB + 50 Class A ops
- Every candidate detail view triggers a signed-url request (Class B)
- `backfill-cv-text` downloads every file for text extraction (Class B burst)

**Mitigation:**
- Cache signed URLs client-side for their TTL (default 60s)
- Batch backfill operations during off-hours
- Set Cloudflare R2 lifecycle rules to auto-delete files older than retention period

### Supabase

| Resource | Free Tier | Pro Plan |
|----------|-----------|----------|
| Database | 500 MB | 8 GB included |
| Edge Function invocations | 500K/month | 2M/month |
| Edge Function compute | 1M ms | 10M ms |
| Realtime connections | 200 concurrent | 500 concurrent |

**Risk triggers:**
- Sync triggers fire on EVERY write to 28 tables → each fires an edge function invocation
- With 10 users doing 100 writes/day = 1,000 sync invocations/day = 30K/month (safe)
- With 50 users doing 500 writes/day = 25,000/day = 750K/month (approaching limit)
- `purge-trash` and `purge-expired-attachments` scan all rows — expensive on large datasets

**Mitigation:**
- Consider disabling sync triggers if not needed (saves ~50% of edge function invocations)
- Add WHERE clauses to purge functions to limit scan scope
- Use `pg_cron` for scheduled tasks instead of external cron hitting edge functions

### AI / Gemini Calls

**Current usage:** `extract-tags` edge function calls Google Gemini for each candidate's notes.

**Cost:** Gemini 2.5 Flash Lite is low-cost (~$0.01 per 1K input tokens) but:
- Bulk importing 200 candidates triggers 200 sequential AI calls
- Each call has ~500 tokens input = ~$1 per 200 candidates

**Mitigation:**
- Batch tag extraction (process in groups of 10-20)
- Cache extracted tags — don't re-extract if notes haven't changed
- Skip extraction for candidates with empty notes

---

## 7. What NOT to Refactor Yet

### `src/context/ATSContext.tsx`
**Why:** This is the central state management for the entire ATS. It handles companies, positions, candidates, stages, owners, and their CRUD operations. It works. Refactoring it (e.g., splitting into smaller contexts or moving to Zustand) risks breaking every component that depends on it. Estimated touch: 30+ components.

### `src/pages/WeeklyReport.tsx`
**Why:** This is a locked module (see `.memory/constraints/locked-modules/weekly-report.md`). It has complex state management for the "NEW" badge system, tab navigation, autosave, and Excel export. The component is large but tested. Refactoring risks breaking the new-entity tracking logic which depends on report index comparisons.

### `src/pages/Sales.tsx`
**Why:** Similar complexity to WeeklyReport — spreadsheet-like UI with inline editing, autosave, and multi-sheet management. Works in production. Refactor only after migration is stable.

### `src/components/ats/KanbanBoard.tsx`
**Why:** Drag-and-drop with `@hello-pangea/dnd`, candidate cards, stage management, bulk actions. The interaction between DnD state and Supabase writes is fragile. Changing this during migration adds unnecessary risk.

### `src/components/ats/CandidateDetailSheet.tsx`
**Why:** Large component with many sub-features (attachments, comments, emails, interviews, tags). Each sub-feature interacts with different tables and edge functions. Changing structure here could break file uploads, comment threading, or interview scheduling.

### `supabase/functions/sync-to-external/index.ts`
**Why:** Already flagged as large (208 lines) but it handles a critical data path. The FULL_SYNC operation is the primary migration tool. Do not refactor until sync is no longer needed or until migration is fully verified.

### Database Triggers and Functions
**Why:** `handle_new_user`, `set_updated_at`, `prevent_update_on_deleted`, `handle_new_board` — these are foundational. They work silently and correctly. Modifying them risks breaking user creation, timestamp tracking, soft-delete protection, and board membership. Migrate as-is, verify they exist in the new environment, and move on.

---

## Summary Decision Matrix

| Component | Migrate As-Is | Refactor After | Drop |
|-----------|:---:|:---:|:---:|
| ATSContext | ✅ | Later | — |
| WeeklyReport | ✅ | No | — |
| Sales | ✅ | Later | — |
| KanbanBoard | ✅ | Later | — |
| sync-to-external | ✅ | After cutover | Maybe |
| Sync triggers (28 tables) | ⚠️ | — | After cutover |
| lovable-tagger (dev dep) | — | — | ✅ |
| @lovable.dev/cloud-auth-js | — | — | ✅ |
| src/integrations/lovable/ | — | Rewrite | ✅ |
| init-sync-config function | — | — | ✅ |

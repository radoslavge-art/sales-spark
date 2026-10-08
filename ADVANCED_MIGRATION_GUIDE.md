# Advanced Migration Guide — ATS (Autsorsa)

> Companion to `README_TECHNICAL.md`. Covers execution risks, hidden dependencies, and operational details.

---

## 1. Dependency Graph (Critical)

### Auth Layer
```
Supabase Auth (auth.users)
  ├── handle_new_user trigger → profiles table
  ├── AuthContext.tsx → session, user, profile, roles
  │     ├── ProtectedRoute.tsx (gate all authenticated routes)
  │     ├── user_sessions table (login/activity tracking)
  │     ├── user_roles table (admin/user/sales checks)
  │     └── Every component that calls useAuth()
  ├── GoogleSignInButton.tsx → OAuth flow
  ├── admin-users Edge Function → user management
  └── Every Edge Function that calls auth.getUser() or auth.getClaims()
```
**If auth fails:** Entire app is inaccessible. No data loads. All edge functions return 401.

### Database Layer
```
PostgreSQL (28 tables)
  ├── ATSContext.tsx → companies, positions, stages, candidates, owners
  │     └── KanbanBoard, Dashboard, StatsPanel, all ATS components
  ├── WeeklyReport → weekly_reports, weekly_report_rows
  ├── Sales → sales_sheets, sales_leads
  ├── MyBoard → personal_columns, personal_tasks
  ├── Boards → boards, board_columns, board_tasks, board_members
  ├── Notifications → notifications table + NotificationBell component
  ├── Interviews → interviews table + InterviewTracker
  └── sync_row_to_external triggers → sync-to-external Edge Function
```
**If DB fails:** App loads but shows empty state. All CRUD operations fail with toasts.

### Storage Layer (R2)
```
Cloudflare R2
  ├── r2-storage Edge Function (proxy)
  │     ├── r2Upload() ← CandidateAttachments.tsx (CV upload)
  │     ├── r2Download() ← CandidateAttachments.tsx (CV download)
  │     ├── r2Delete() ← CandidateAttachments.tsx (CV delete)
  │     └── r2SignedUrl() ← CandidateFilePreview.tsx (inline preview)
  ├── backfill-cv-text Edge Function (text extraction)
  ├── migrate-storage-to-r2 Edge Function (one-time migration)
  └── purge-expired-attachments Edge Function (cleanup)
```
**If R2 fails:** Candidate detail sheet works except file operations. Upload/download buttons fail. CV search returns no results for content-based queries.

### AI Layer
```
Google Gemini (via gateway)
  └── extract-tags Edge Function
        └── CandidateDetailSheet → auto-tag extraction on notes change
```
**If AI fails:** Tags field stays empty or returns []. No other features affected. Graceful degradation.

---

## 2. Runtime Risk Analysis (Top 10)

### 1. Sync Trigger Cascade on Bulk Operations
**What can go wrong:** Importing 200 candidates fires 200 sync triggers, each making an HTTP POST via `pg_net`. The queue backs up, slowing all writes.
**How it fails:** Writes take 3-10 seconds. Users see "saving..." spinners that never resolve. Eventually `pg_net` queue overflows.
**Detection:** Check `pg_net._http_response` for failed/pending requests. Monitor edge function invocation count in Supabase dashboard.
**Mitigation:** Temporarily disable sync triggers before bulk imports:
```sql
ALTER TABLE candidates DISABLE TRIGGER sync_candidates;
-- do import
ALTER TABLE candidates ENABLE TRIGGER sync_candidates;
-- then run FULL_SYNC to catch up
```

### 2. R2 Signed URL Expiration During File Preview
**What can go wrong:** Signed URLs expire after 60 seconds (default). If a user opens a file preview and waits, the URL expires. Refreshing the preview fails.
**How it fails:** Image/PDF preview shows broken image or "Failed to load" error.
**Detection:** Network tab shows 403 on the R2 signed URL.
**Mitigation:** Increase `expiresIn` to 3600 (1 hour) for preview URLs. Add retry logic in `CandidateFilePreview.tsx`.

### 3. handle_new_user Trigger Missing After Migration
**What can go wrong:** The trigger on `auth.users` doesn't get recreated because it's on a Supabase-reserved schema.
**How it fails:** New users register successfully but see empty data. No profile row exists, so RLS silently filters everything.
**Detection:** `SELECT COUNT(*) FROM profiles` vs `SELECT COUNT(*) FROM auth.users` — mismatch indicates missing trigger.
**Mitigation:** Manually create the trigger on the target Supabase project via SQL editor (not via migrations).

### 4. Google OAuth Token Mismatch
**What can go wrong:** After migration, the Google OAuth Client ID in Supabase doesn't match the one configured in Google Cloud Console.
**How it fails:** "Error 400: redirect_uri_mismatch" on Google consent screen.
**Detection:** Browser shows Google error page with specific mismatch details.
**Mitigation:** Ensure redirect URI in Google Console matches exactly: `https://<ref>.supabase.co/auth/v1/callback`

### 5. Edge Function Cold Start on Critical Path
**What can go wrong:** First call to `r2-storage` after idle period takes 2-5 seconds (Deno cold start).
**How it fails:** User clicks "Upload CV" → long wait → timeout or success after delay.
**Detection:** Edge function logs show first invocation taking >3s.
**Mitigation:** Accept as normal Supabase behavior. Add loading spinners. Consider warming functions with a health-check cron.

### 6. RLS Policy Denying Legitimate Writes
**What can go wrong:** A security-definer function like `has_role()` doesn't exist yet. RLS policies that reference it fail closed (deny access).
**How it fails:** Users can read data but can't create/update. Error: "new row violates row-level security policy".
**Detection:** Supabase logs show RLS violations. Frontend shows "Failed to save" toasts.
**Mitigation:** Deploy all security-definer functions BEFORE enabling RLS on any table.

### 7. Candidate Attachments Table Orphaned Records
**What can go wrong:** Attachment metadata exists in DB but file was never uploaded to R2 (upload failed mid-way).
**How it fails:** Download button exists but clicking it returns "Download failed from both R2 and legacy storage".
**Detection:** Query attachments where `upload_status != 'complete'` or where R2 HEAD returns 404.
**Mitigation:** Add a cleanup job that checks R2 existence and marks orphaned records.

### 8. Weekly Report Sort Order Corruption
**What can go wrong:** Multiple users create reports simultaneously. Auto-increment `sort_order` creates duplicates.
**How it fails:** Tab order is unpredictable. "NEW" badges appear/disappear incorrectly.
**Detection:** `SELECT sort_order, COUNT(*) FROM weekly_reports GROUP BY sort_order HAVING COUNT(*) > 1`
**Mitigation:** Use `COALESCE(MAX(sort_order), 0) + 1` in a transaction when creating new reports.

### 9. ATSContext Full Reload on Any Change
**What can go wrong:** `ATSContext` fetches ALL companies, positions, stages, candidates, and owners on mount and after any mutation.
**How it fails:** With 5000+ candidates, each save triggers a full refetch. UI becomes sluggish.
**Detection:** Network tab shows large payloads on `/rest/v1/candidates?select=*`. React DevTools shows frequent ATSContext re-renders.
**Mitigation:** Implement optimistic updates and targeted invalidation instead of full refetch. But NOT during migration — this is a post-migration optimization.

### 10. pg_net Extension Not Available
**What can go wrong:** Target Supabase project doesn't have `pg_net` extension enabled. Sync triggers fail silently.
**How it fails:** Data writes succeed locally but never sync. No errors visible to users.
**Detection:** `SELECT * FROM pg_extension WHERE extname = 'pg_net'` returns empty.
**Mitigation:** Enable via SQL: `CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;` (requires Supabase Pro plan or higher).

---

## 3. Lovable Hidden Behavior (Important)

### Auto-Handled Auth Flows
- **Lovable Cloud manages Google OAuth credentials** — provides a proxy that handles token exchange. After migration, you must configure your own Google OAuth Client ID/Secret in the Supabase dashboard.
- **`@lovable.dev/cloud-auth-js`** wraps `supabase.auth.signInWithOAuth()` with Lovable-specific redirect handling. Must be replaced with direct Supabase calls.
- **ES256 signing keys** — Lovable Cloud uses ES256 JWT signing. Standard Supabase uses HS256. Edge functions using `auth.getClaims()` may need adjustment to `auth.getUser()` if token verification fails.

### Background Processes
- **Profile auto-creation** — `handle_new_user` trigger on `auth.users` automatically creates a `profiles` row. This trigger is on a reserved schema and won't appear in standard migration exports. Must be manually recreated.
- **Session tracking** — `AuthContext.tsx` creates `user_sessions` records on login and heartbeats `last_active_at` every 5 minutes. This is pure frontend logic and migrates automatically.
- **`set_updated_at` trigger** — fires on multiple tables to auto-set `updated_at` on UPDATE. Migrates via SQL but verify it exists on all expected tables.

### Silent Fallbacks
- **R2 download fallback** — `r2Download()` in `r2Storage.ts` falls back to Supabase Storage bucket `candidate-attachments` if R2 returns an error. This means some files may still be in legacy storage.
- **AI tag extraction** — if the Gemini call fails, `extract-tags` returns `{ tags: [] }` silently. No error shown to user.
- **`withRetry.ts`** — wraps Supabase calls with automatic retry (exponential backoff). This is client-side and migrates automatically.

### Caching
- **TanStack React Query** — manages caching for Supabase queries. Default stale time and cache time are in effect. No special Lovable configuration.
- **No CDN caching** — R2 signed URLs are generated per-request. No edge caching layer.

### Lovable-Managed Infrastructure
- **Edge Function deployment** — Lovable auto-deploys edge functions on code change. After migration, you must deploy manually via `supabase functions deploy <name>`.
- **Database migrations** — Lovable applies migrations automatically. After migration, use `supabase db push` or apply SQL files manually.
- **Environment variables** — `.env` file is auto-generated by Lovable. After migration, create it manually or use your hosting provider's env var system.
- **`supabase/config.toml`** — auto-generated with project settings. After migration, update `project_id` and any function-specific overrides.

---

## 4. Edge Function Dependency Map

```
Independent (no inter-function dependencies):
  ├── r2-storage          [CRITICAL] — all file operations
  ├── extract-tags        [OPTIONAL] — AI tag extraction
  ├── admin-users         [CRITICAL for admin] — user management
  ├── find-user-by-email  [OPTIONAL] — board sharing user lookup
  ├── check-interview-reminders [OPTIONAL] — scheduled reminders
  ├── detect-anomalies    [OPTIONAL] — security monitoring
  └── google-calendar     [OPTIONAL] — calendar integration

Dependent on R2 secrets:
  ├── r2-storage
  ├── backfill-cv-text         (downloads from R2 → extracts text)
  ├── migrate-storage-to-r2    (one-time, reads Supabase Storage → writes R2)
  └── purge-expired-attachments (deletes from R2)

Dependent on external Supabase secrets:
  ├── sync-to-external    [OPTIONAL after migration]
  └── init-sync-config    [ONE-TIME setup, can delete after]

Migration-only (safe to delete after migration):
  ├── migrate-storage-to-r2
  ├── migrate-to-external
  └── init-sync-config

Scheduled (need pg_cron or external cron):
  ├── check-interview-reminders  — every 10 minutes
  ├── purge-trash               — daily
  └── purge-expired-attachments — daily
```

### Secret Requirements per Function

| Function | SUPABASE_SERVICE_ROLE_KEY | R2_* | EXTERNAL_* | LOVABLE_API_KEY / GOOGLE_AI_API_KEY |
|----------|:---:|:---:|:---:|:---:|
| r2-storage | — | ✅ | — | — |
| extract-tags | — | — | — | ✅ |
| admin-users | ✅ | — | — | — |
| backfill-cv-text | ✅ | ✅ | — | — |
| check-interview-reminders | ✅ | — | — | — |
| purge-trash | ✅ | — | — | — |
| purge-expired-attachments | ✅ | ✅ | — | — |
| sync-to-external | ✅ | — | ✅ | — |
| find-user-by-email | ✅ | — | — | — |
| detect-anomalies | ✅ | — | — | — |
| google-calendar | — | — | — | — |

---

## 5. Migration Order (Execution Plan)

### Phase 1: Auth Foundation
1. Create Supabase project (Pro plan recommended)
2. Configure Google OAuth provider in Supabase dashboard (Authentication → Providers → Google)
3. Set redirect URI in Google Cloud Console to `https://<ref>.supabase.co/auth/v1/callback`
4. **Verify:** Go to `https://<ref>.supabase.co/auth/v1/authorize?provider=google` — should redirect to Google consent

### Phase 2: Schema
5. Run all migration SQL files from `supabase/migrations/` in chronological order
6. Verify all tables exist: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
7. Verify all functions exist: `SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;`
8. Verify all RLS policies: `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';`
9. **Manually create** the `handle_new_user` trigger on `auth.users`:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Phase 3: Data
10. Use `migrate-to-external` edge function with `step=data` OR use `pg_dump` / `pg_restore`
11. Verify row counts match source:
```sql
SELECT 'companies' as t, COUNT(*) FROM companies
UNION ALL SELECT 'positions', COUNT(*) FROM positions
UNION ALL SELECT 'candidates', COUNT(*) FROM candidates
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles;
```

### Phase 4: Auth Users
12. Migrate auth users via `migrate-to-external` with `step=users` OR manually re-invite users
13. Verify: `SELECT id, email FROM auth.users;`
14. Verify profiles exist for all users: `SELECT u.id, p.id IS NOT NULL as has_profile FROM auth.users u LEFT JOIN profiles p ON u.id = p.id;`

### Phase 5: Storage (R2)
15. Create R2 bucket in Cloudflare dashboard
16. Create R2 API token with Object Read & Write
17. Set all R2 secrets in Supabase Edge Function secrets
18. Deploy `r2-storage` edge function
19. **Verify:** Upload a test file via curl, then download it

### Phase 6: Edge Functions
20. Set all secrets (SUPABASE_SERVICE_ROLE_KEY, R2_*, etc.)
21. Deploy all edge functions: `supabase functions deploy --all`
22. Test each function individually (see Post-Migration Verification in MIGRATION_SURVIVAL_GUIDE.md)

### Phase 7: Frontend
23. Update `.env` with new Supabase URL and anon key
24. Replace `lovable.auth.signInWithOAuth` with `supabase.auth.signInWithOAuth`
25. Remove `@lovable.dev/cloud-auth-js` and `src/integrations/lovable/`
26. Build: `npm run build`
27. Deploy to hosting provider

### Phase 8: Scheduled Jobs
28. Enable `pg_cron` extension
29. Create cron schedules:
```sql
SELECT cron.schedule('check-reminders', '*/10 * * * *', $$
  SELECT net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/check-interview-reminders',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('purge-trash', '0 3 * * *', $$
  SELECT net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/purge-trash',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('purge-attachments', '0 4 * * *', $$
  SELECT net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/purge-expired-attachments',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
```

---

## 6. Minimal Viable Migration (MVM)

### Must Work (Core)
- Email/password login and registration
- Company → Position → Candidate CRUD
- Kanban board (drag-and-drop stage changes)
- Candidate detail sheet (view/edit all fields)
- CV upload and download (R2)

### Can Be Temporarily Disabled
- Google OAuth (use email/password only initially)
- AI tag extraction (tags can be added manually)
- Weekly reports (not blocking daily recruitment work)
- Sales module (separate workflow)
- Board sharing / team boards (personal boards still work)
- Interview reminders (users can check manually)
- Real-time sync to external DB
- Admin panel email change feature
- Notification bell
- Google Calendar integration

### Migrate Later
- Scheduled jobs (purge-trash, purge-attachments, reminders)
- Security anomaly detection
- Activity logging
- Board presence (real-time avatars)

---

## 7. Observability & Debugging

### Frontend Error Logging
- **Toast notifications** — all Supabase errors surface via `toast()` from `src/hooks/use-toast.ts`
- **Console errors** — Supabase SDK logs failed queries to console
- **React Query** — failed queries visible in React Query DevTools (install `@tanstack/react-query-devtools`)

### Edge Function Logging
```bash
# View logs for a specific function
supabase functions logs r2-storage --limit 50

# View logs for all functions
supabase functions logs --limit 100
```
All edge functions use `console.error()` for error logging. In production, these appear in Supabase dashboard → Edge Functions → Logs.

### Debugging Common Issues

**Failed uploads:**
1. Check browser Network tab for the POST to `/functions/v1/r2-storage?action=upload`
2. Check response body for error message
3. Check edge function logs: `supabase functions logs r2-storage`
4. Verify R2 credentials: look for "R2 upload failed: 403" in logs

**Failed AI calls:**
1. Check edge function logs: `supabase functions logs extract-tags`
2. Look for "fetch failed" or API key errors
3. Test manually: `curl -X POST .../functions/v1/extract-tags -H "Authorization: Bearer <token>" -d '{"text":"test notes"}'`

**Failed auth:**
1. Check Supabase Auth logs in dashboard → Authentication → Logs
2. Check browser console for `AuthError` or `AuthSessionMissingError`
3. Verify Google OAuth redirect URI matches exactly
4. Check if email domain restriction is blocking registration

### Monitoring Checklist
- [ ] Supabase dashboard → Database → Query Performance (slow queries)
- [ ] Supabase dashboard → Edge Functions → Invocations (error rate)
- [ ] Supabase dashboard → Authentication → Logs (auth failures)
- [ ] Cloudflare dashboard → R2 → Metrics (storage usage, request counts)

---

## 8. Performance & Scaling Risks

### Large Queries
- **ATSContext full fetch** — loads ALL candidates, companies, positions, stages, owners on mount. With 5000+ candidates, this can take 2-5 seconds. Supabase default limit is 1000 rows — if you have more, you'll see truncated data.
  - **Fix:** Add `.range()` pagination or filter by active position
  - **Workaround:** Increase default with `.limit(10000)` but monitor payload size

- **Weekly report rows** — fetches all rows for all reports. With 100 reports × 20 rows = 2000 rows per load.
  - **Fix:** Fetch rows only for the active tab

- **FULL_SYNC operation** — scans all 28 tables sequentially. With large datasets, can take 30+ seconds and hit edge function timeout (60s default).
  - **Fix:** Increase function timeout or batch by table

### Large Components
- **WeeklyReport** — complex state management, Excel export, autosave. Renders 20+ input fields per row × 20 rows = 400+ controlled inputs.
- **Sales** — similar complexity with inline editing across many columns
- **KanbanBoard** — re-renders all cards on any candidate change due to ATSContext

### Recommended Database Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_candidates_position_id ON candidates(position_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_stage_id ON candidates(stage_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_candidate_attachments_candidate_id ON candidate_attachments(candidate_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_report_rows_report_id ON weekly_report_rows(report_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, read) WHERE read = false;
```

### R2 Performance
- **Signed URL generation** — each call hits the edge function → R2 API. For a candidate with 5 attachments, that's 5 sequential edge function calls.
  - **Fix:** Batch signed URL generation in a single edge function call
- **Upload size** — no client-side size limit enforced (only 10MB check in CandidateAttachments). Large files (50MB+) will timeout.
  - **Fix:** Add client-side validation and consider multipart upload for large files

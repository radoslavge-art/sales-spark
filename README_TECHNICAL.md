# Technical Migration README — ATS (Autsorsa)

> Purpose: Help migrate this project OUT of Lovable into a fully independent, developer-owned codebase.

---

## 1. Project Overview

**What it does:** A full-featured Applicant Tracking System (ATS) for recruitment agencies. Manages companies, positions, candidates through a Kanban pipeline, with CV storage, AI-powered tag extraction, interview scheduling, weekly reporting, and a sales CRM module.

**Main features:**
- Kanban board for candidate pipeline management (drag-and-drop stages)
- CV upload/download via Cloudflare R2 (with text extraction for search)
- AI-powered tag extraction from candidate notes (Google Gemini)
- Weekly recruitment reports with Excel export
- Sales lead tracking (multi-sheet CRM)
- Personal task boards per user
- Shared team boards with real-time presence
- Admin panel (user management, role assignment, activity logs)
- Google OAuth + email/password authentication
- Multi-language support (English / Bulgarian)
- Dark/light theme
- Mobile-responsive layout
- Real-time sync to external Supabase project

**Target user:** Recruitment agency staff (recruiters, managers, admins) at Autsorsa / Anagami.

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 18.3.x |
| Build tool | Vite | 8.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| UI Components | shadcn/ui (Radix primitives) | — |
| State management | React Context + TanStack React Query | 5.x |
| Routing | React Router DOM | 6.x |
| Drag & Drop | @hello-pangea/dnd | 18.x |
| Charts | Recharts | 2.x |
| Backend / DB | Supabase (PostgreSQL) | — |
| File storage | Cloudflare R2 (via Edge Function proxy) | — |
| AI | Google Gemini (via Lovable AI gateway → migrate to direct) | — |
| Auth | Supabase Auth (email/password + Google OAuth) | — |
| Edge Functions | Deno (Supabase Edge Functions) | — |
| Excel export | ExcelJS + xlsx | — |
| PDF parsing | pdf-parse (in Edge Function) | — |
| DOCX parsing | mammoth | — |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ ATSContext│ │AuthContext│ │LanguageContext   │ │
│  └────┬─────┘ └────┬─────┘ └──────────────────┘ │
│       │             │                             │
│  Components: KanbanBoard, WeeklyReport, Sales,   │
│  AdminPanel, MyBoard, CandidateDetailSheet, etc. │
└───────┬─────────────┬────────────────────────────┘
        │             │
        ▼             ▼
┌───────────────┐ ┌──────────────────┐
│ Supabase SDK  │ │ Edge Functions   │
│ (client.ts)   │ │ (Deno runtime)   │
│ - CRUD        │ │ - r2-storage     │
│ - Auth        │ │ - extract-tags   │
│ - Realtime    │ │ - admin-users    │
└───────┬───────┘ │ - backfill-cv    │
        │         │ - purge-trash    │
        ▼         │ - sync-external  │
┌───────────────┐ │ - check-remind.  │
│  PostgreSQL   │ │ - find-user      │
│  (28 tables)  │ │ - google-cal     │
│  + RLS        │ │ - migrate-*      │
│  + Triggers   │ └────────┬─────────┘
│  + Functions  │          │
└───────────────┘          ▼
                  ┌──────────────────┐
                  │  Cloudflare R2   │
                  │  (CV file store) │
                  └──────────────────┘
```

---

## 4. Database Schema (28 Tables)

### Core ATS Tables
| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `companies` | Client companies | Parent of `positions`, `stages` |
| `positions` | Job positions | FK → `companies` |
| `stages` | Pipeline stages per company | FK → `companies` |
| `candidates` | Candidate records | FK → `positions`, `stages`, `owners` |
| `owners` | Candidate owners/recruiters | Referenced by `candidates` |
| `candidate_attachments` | CV/file metadata | FK → `candidates` |
| `candidate_comments` | Notes on candidates | FK → `candidates` |
| `candidate_emails` | Email records | FK → `candidates` |
| `interviews` | Scheduled interviews | FK → `candidates` |

### User & Auth Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (name, email, settings) |
| `user_roles` | Role assignments (admin, user, sales) |
| `user_sessions` | Login/activity tracking |

### Board Tables
| Table | Purpose |
|-------|---------|
| `boards` | Shared team boards |
| `board_columns` | Columns in shared boards |
| `board_tasks` | Cards/tasks in shared boards |
| `board_members` | Board membership & roles |
| `board_activities` | Board activity log |
| `personal_columns` | User's personal board columns |
| `personal_tasks` | User's personal board tasks |

### Reporting Tables
| Table | Purpose |
|-------|---------|
| `weekly_reports` | Weekly report headers |
| `weekly_report_rows` | Individual report line items |
| `sales_sheets` | Sales CRM sheet headers |
| `sales_leads` | Sales lead records |

### System Tables
| Table | Purpose |
|-------|---------|
| `activities` | Generic activity log |
| `activity_logs` | Detailed audit log |
| `notifications` | User notifications |
| `security_alerts` | Security event tracking |
| `google_calendar_tokens` | Google Calendar OAuth tokens |
| `sync_config` | External sync configuration |

---

## 5. Authentication System

**Current setup:** Supabase Auth with two methods:
1. **Email/password** — restricted to `@autsorsa.com` and `@anagami.bg` domains (client-side check only)
2. **Google OAuth** — currently via Lovable managed proxy (`lovable.auth.signInWithOAuth`)

**Migration requirement:**
- Replace `lovable.auth.signInWithOAuth("google", ...)` with `supabase.auth.signInWithOAuth({ provider: 'google', ... })`
- Remove `@lovable.dev/cloud-auth-js` dependency
- Remove `src/integrations/lovable/` directory
- Configure Google OAuth directly in Supabase dashboard
- Add server-side domain restriction (currently only client-side)

**Key files:**
- `src/context/AuthContext.tsx` — session management, profile loading, role checking
- `src/pages/Login.tsx` — login form
- `src/pages/Register.tsx` — registration with domain check
- `src/components/GoogleSignInButton.tsx` — Google OAuth trigger
- `src/components/ProtectedRoute.tsx` — route guard

---

## 6. File Storage (Cloudflare R2)

**Architecture:** Files are stored in Cloudflare R2, accessed through a Supabase Edge Function proxy (`r2-storage`).

**Flow:**
1. Frontend calls `r2Upload()` / `r2Download()` / `r2Delete()` from `src/lib/r2Storage.ts`
2. These make authenticated HTTP requests to `POST /functions/v1/r2-storage?action=upload|download|delete`
3. Edge function verifies JWT, then proxies to R2 using `aws4fetch`
4. Metadata stored in `candidate_attachments` table

**Fallback:** `r2Download()` falls back to Supabase Storage bucket `candidate-attachments` for pre-migration files.

**Required secrets:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

---

## 7. AI Integration

**Current:** `extract-tags` edge function calls the Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `LOVABLE_API_KEY`.

**Migration:** Replace with direct Google Gemini API call:
- Get a `GOOGLE_AI_API_KEY` from Google AI Studio
- Update `extract-tags/index.ts` to call `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`
- Or use the OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`

---

## 8. Edge Functions Inventory

| Function | Purpose | Trigger | Required Secrets |
|----------|---------|---------|-----------------|
| `r2-storage` | R2 file proxy (upload/download/delete/signed-url) | Frontend call | R2_* |
| `extract-tags` | AI tag extraction from candidate notes | Frontend call | LOVABLE_API_KEY → GOOGLE_AI_API_KEY |
| `admin-users` | User management (list/delete/role/email) | Admin panel | SUPABASE_SERVICE_ROLE_KEY |
| `backfill-cv-text` | Extract text from PDFs/DOCXs in R2 | Manual trigger | R2_*, SUPABASE_SERVICE_ROLE_KEY |
| `check-interview-reminders` | Send interview reminder notifications | Scheduled (cron) | SUPABASE_SERVICE_ROLE_KEY |
| `purge-trash` | Hard-delete soft-deleted records >30 days | Scheduled (cron) | SUPABASE_SERVICE_ROLE_KEY |
| `purge-expired-attachments` | Delete attachments >6 months | Scheduled (cron) | R2_*, SUPABASE_SERVICE_ROLE_KEY |
| `sync-to-external` | Mirror data to external Supabase | DB triggers | EXTERNAL_SUPABASE_* |
| `find-user-by-email` | Look up user by email | Frontend call | SUPABASE_SERVICE_ROLE_KEY |
| `google-calendar` | Google Calendar integration | Frontend call | — |
| `migrate-storage-to-r2` | One-time migration from Supabase Storage to R2 | Manual | R2_*, SUPABASE_SERVICE_ROLE_KEY |
| `migrate-to-external` | Schema + data migration to external Supabase | Manual | — |
| `init-sync-config` | Set up sync configuration | Manual (one-time) | — |
| `detect-anomalies` | Security anomaly detection | Manual | SUPABASE_SERVICE_ROLE_KEY |

---

## 9. Lovable-Specific Code to Remove/Replace

### Must Remove
| Item | Location | Replacement |
|------|----------|-------------|
| `@lovable.dev/cloud-auth-js` | `package.json` | Remove entirely |
| `lovable-tagger` | `package.json` (devDep) | Remove entirely |
| `src/integrations/lovable/` | Directory | Delete |
| `lovable.auth.signInWithOAuth()` | `GoogleSignInButton.tsx` | `supabase.auth.signInWithOAuth()` |
| `playwright-fixture.ts` | Root | Replace with standard Playwright config |

### Must Replace
| Item | Current | Target |
|------|---------|--------|
| AI gateway URL | `ai.gateway.lovable.dev` | Direct Gemini API |
| `LOVABLE_API_KEY` secret | Lovable-managed | `GOOGLE_AI_API_KEY` |
| Auth initialization | Lovable Cloud signing keys | Standard Supabase JWT |

### Safe to Reuse (No Changes Needed)
- All Supabase SDK calls (`supabase.from(...)`, `supabase.auth.signInWithPassword(...)`)
- All React components (shadcn/ui, custom components)
- All context providers (ATSContext, LanguageContext)
- All hooks
- Tailwind configuration and styling
- R2 storage edge function and client library
- All other edge functions (after secret updates)
- Database schema, RLS policies, triggers, functions

---

## 10. Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=<your-ref>
```

### Edge Function Secrets (Supabase Dashboard)
```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=<bucket-name>
GOOGLE_AI_API_KEY=<gemini-api-key>
EXTERNAL_SUPABASE_URL=<optional-external-url>
EXTERNAL_SUPABASE_SERVICE_ROLE_KEY=<optional-external-key>
```

---

## 11. Deployment

### Frontend
Standard Vite build:
```bash
npm install
npm run build  # outputs to dist/
```
Deploy `dist/` to Vercel, Netlify, Cloudflare Pages, or any static host.

### Edge Functions
Deploy via Supabase CLI:
```bash
supabase functions deploy r2-storage
supabase functions deploy extract-tags
supabase functions deploy admin-users
# ... repeat for each function
```

### Database
Apply migrations in order:
```bash
supabase db push
# or manually run each file in supabase/migrations/ in chronological order
```

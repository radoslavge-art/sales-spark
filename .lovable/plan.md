# Add your branch's features to this CRM

Source: GitHub `radoslavge-art/sales-spark`, branch `codex/integrate-ats-crm`.

## Result

One app that keeps everything this CRM has today and adds everything you picked from the branch:

- **Kept as-is:** Dashboard, Leads (contact history, movable columns, custom tag columns), Deals, Activities, AI Assistant, Settings, dark mode, English/Bulgarian switch.
- **Added from your branch:**
  - **Candidate board (ATS):** board of candidates with positions, stages, CV upload and preview, interviews, comments, emails, import/export, trash, rejected list, shared boards, personal boards.
  - **Weekly Report** and **Sales** pages.
  - **Admin panel:** user management, activity logs, security alerts, sessions, storage scanner.
  - **Real accounts:** register, sign in, forgot/reset password, name prompt, user settings, notifications.
- One sidebar with sections: CRM (current pages), Recruiting (candidate board), Reports (Weekly Report, Sales), Admin (shown only to admins).
- Your branch's own simpler "CRM" page is left out, because the current CRM pages already cover it and do more.

## Steps

1. **Turn on Lovable Cloud** for logins, the database, file storage and server functions.
2. **Recreate the database** from your branch's 45 change files: candidates, boards, positions, stages, interviews, attachments, weekly reports, sales sheets, notifications, profiles, roles (admin / manager / sales rep), activity logs, security, and the CRM leads/deals/activities tables. Access rules stay the same as on your branch.
3. **Bring over the code:** the candidate-board components, the new pages, the login context and helpers. Merge the extra libraries your branch uses into this project.
4. **Join the layouts:** add the new pages to the current sidebar and header. Every page gets dark mode, and the language switcher covers the new pages wherever your branch already has translations.
5. **Server functions:** bring over the ones the chosen features need: admin users, find user by email, CV text and tag extraction (AI), interview reminders, anomaly detection, trash and expired-attachment cleanup, file storage, and Google Calendar.
6. **Check:** register, sign in, add a candidate, upload a CV, create a weekly report row, open the admin panel as an admin, and confirm that a sales rep can't see another rep's data.

## What I'll need from you later

- **File storage (Cloudflare R2):** your branch stores CVs in R2. I'll keep that and ask for the 4 R2 keys through a secure form. Without them, uploads stay off.
- **Google Calendar:** the Google client ID and secret, also through the secure form. Without them, calendar sync stays off.
- **Existing data and users:** your branch had its own database. This preview starts empty. Afterwards you can send exports so I can bring the records and users over. Existing users keep their profiles, and on their first visit they confirm their email and choose a new password.

## Left out (tell me if you want them)

- `migrate-to-external`, `sync-to-external`, `migrate-storage-to-r2`, `init-sync-config`: tools for copying data out to another database. Lovable Cloud does that job now.
- Your branch's simple CRM page, as described above.

## Technical details

- Branch diff vs main: 207 files, +40,974 / -5,034. The branch deletes this project's CRM files; that deletion is not applied.
- Approach: copy `src/components/ats/**`, `src/components/mobile/**`, `src/context/AuthContext`, `src/lib/**`, `src/hooks/**`, `src/i18n/**`, `src/types/**`, and the pages `AdminPanel`, `Index` (board, mounted at `/recruiting`), `WeeklyReport`, `Sales`, `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `NamePrompt`, `UserSettings`. Resolve name clashes (`Login.tsx`, `Dashboard`, `NotFound`, the two i18n systems) by keeping the current CRM versions and namespacing the branch versions. The current mock Login is replaced by the branch's real one.
- Routes: CRM stays at `/`, `/leads`, `/deals`, `/activities`, `/ai`, `/settings`. New: `/recruiting`, `/weekly-report`, `/sales`, `/admin`, `/account`, plus the auth routes. Everything except the auth routes requires a session (route guard from `AuthContext`).
- Database: replay the migrations in order through the migration tool, adding missing `GRANT`s for every public table. Roles stay in `user_roles` with a `has_role` security-definer function.
- Edge functions copied from `supabase/functions/*` for the listed set, with `config.toml` entries (e.g. `extract-tags` `verify_jwt = false`). AI calls use the built-in AI gateway (`LOVABLE_API_KEY`).
- Ledger kept at `.lovable/migrate-external-project/ledger.json`.
- Current CRM pages keep their sample data in this pass. Wiring them to the `crm_*` tables can follow as a separate step.

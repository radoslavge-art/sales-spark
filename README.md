# Sales Spark

I want to build an internal web-based CRM platform for a sales team, designed to replace spreadsheet-based lead tracking with a structured and user-friendly system.

Main goal:

Create a centralized platform for managing leads, deals, and sales activities, with clear tracking, performance insights, and AI-assisted workflows.

Users and roles:

- Admin

- Manager

- Sales Rep

Authentication & Security:

- Implement login and registration

- Role-based access control

- Admin has full access

- Manager can view and manage team-level data and performance

- Sales reps can only access and manage their own leads, deals, and activities

Core modules:

1. Leads

- Create, edit, and manage leads

- Assign leads to users

- Add notes to each lead

- Track lead history and interactions

- Pipeline statuses:

  - New

  - Contacted

  - Qualified

  - Negotiation

  - Won

  - Lost

- Search and filtering (by status, owner, company, etc.)

2. Deals

- Create deals from leads

- Edit and manage deals

- Track deal value

- Deal status

- Expected close date

- Assigned owner

3. Activities

- Log activities related to leads or deals

- Activity types:

  - Call

  - Email

  - Meeting

  - Follow-up

  - Note

- Each activity includes:

  - Date and time

  - Responsible user

  - Description

- Ability to set reminders (follow-ups)

4. Dashboard (Key Metrics Focus)

- KPI overview with summary cards

- Number of new leads

- Conversion rate (lead → deal → won)

- Sales reps activity tracking (calls, emails, meetings, follow-ups)

- Leads by status

- Deals by status

- Upcoming follow-ups / reminders

- Manager/Admin team performance overview

5. AI Features

- AI email assistant:

  - Generate personalized outreach emails based on lead data (name, company, context)

  - Provide multiple tone options (formal, friendly, persuasive)

- AI lead analysis:

  - Evaluate lead quality (high / medium / low priority)

  - Suggest next best action (call, email, follow-up)

  - Highlight important insights (e.g. potential value, urgency, engagement likelihood)

6. Email Integration (structure-ready)

- Track email-related activities

- UI placeholder for sending emails

- Prepare backend for future full integration

7. Automations

- Automatically create follow-up reminders after status changes

- Automatically log activities when actions are performed

- Prepare system for future automation rules

Data structure (database tables):

Users

- id

- full_name

- email

- role (admin, manager, sales)

- team

- created_at

Leads

- id

- first_name

- last_name

- company

- email

- phone

- source

- status

- assigned_to (user id)

- priority

- notes

- created_at

- updated_at

Deals

- id

- lead_id

- title

- value

- status

- expected_close_date

- assigned_to

- created_at

- updated_at

Activities

- id

- lead_id

- deal_id

- user_id

- type

- description

- due_date

- completed (boolean)

- created_at

Main user flow:

1. Sales rep creates a lead

2. Lead is assigned to a user

3. Sales rep updates lead status through the pipeline

4. Adds notes and activities

5. Sets follow-up reminders

6. Converts lead into a deal if needed

7. Manager monitors performance via dashboard

8. AI assists with email writing and lead prioritization

9. Admin manages users and system

UI / UX requirements:

- Modern, clean, minimalistic interface

- Style similar to Notion + HubSpot

- Sidebar navigation

- Dashboard with cards and charts

- Table views with filters and search

- Status badges and quick actions

- Responsive design

Technology:

- Use Supabase for authentication and database

- Implement role-based access

- Apply Row Level Security (RLS) policies

- Ensure users only access permitted data

- Structure the app to be scalable for AI and integrations

MVP scope (must include):

- Authentication

- Role-based access

- Leads CRUD

- Deals CRUD

- Activities tracking

- Pipeline statuses

- Dashboard with key metrics (new leads, conversion rate, activity)

- Search and filters

- Reminder UI

- Basic AI features (email generation + lead insights placeholder)

Prepare the system for future features:

- Full email integration

- Advanced AI automations

- Advanced reporting and analytics

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c2ae5e35-1c2d-4cdc-8f92-f78671918ff6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# SimpleTodo

A small, dark personal task board. Create lists, add tasks, and move things into a better order. Lists and tasks are stored in Supabase and protected by row level security.

## Stack

React, TypeScript, Vite, React Router, Tailwind CSS, Supabase Auth/PostgreSQL, dnd-kit, and Vite PWA. Vercel deployment is configured with a SPA rewrite.

## Local development

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and fill in the Supabase project URL and anon/public key.
4. Run `npm run dev` and open the local address Vite prints.

Without Supabase credentials, the UI can be built but account and saved-board actions are disabled.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/20261014000000_initial_schema.sql` using the Supabase CLI (`supabase db push`) or the SQL editor. The migration creates the profile, list, and task tables, a profile creation trigger, foreign keys, indexes, and RLS policies. Lists cascade-delete their tasks.
3. In Authentication settings, enable email/password sign-in. Configure the site URL and allowed redirect URLs for local development (`http://localhost:5173`) and your deployed domain. If email confirmation is enabled, users confirm their address before signing in; email changes require confirmation according to the project's Supabase Auth settings.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings in `.env`. These are public browser credentials. Never put the service-role key in this app.

## Environment variables

| Name | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

## Commands

- `npm run dev` — start Vite for local development.
- `npm run build` — type-check and create the production bundle in `dist/`.
- `npm run preview` — preview the production bundle locally.
- `npm test` — run the Vitest test suite (tests can be added as the project grows).

## PWA

Vite PWA generates the web app manifest and service worker during production builds. Static app assets are precached; API data is not cached as an offline source of truth. Writes still require Supabase connectivity.

## Vercel deployment

Import the repository in Vercel and use the Vite defaults (`npm run build`, output directory `dist`). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment settings, then deploy. Add the production domain as the Supabase Auth Site URL / allowed redirect URL. `vercel.json` supplies the client-side route rewrite.

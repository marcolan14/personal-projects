# CrossFit Tracker

A mobile-first web app to track your daily CrossFit WOD (Workout Of the Day) and log your results. Upload a screenshot of the WOD board, let Claude extract the workout structure, then log your score with a form tailored to that workout's format (strength, for-time, AMRAP, EMOM).

## Features

- **Magic-link login** — no passwords, just email (via Supabase Auth).
- **WOD from a screenshot** — upload one or more photos of today's board; Claude (Anthropic API) reads them and turns them into structured data (movements, sets, reps, weights, time domains).
- **Edit / replace the WOD** — fix anything the AI got wrong, or swap in a different workout for the day.
- **Smart result logging** — the form adapts to the workout type and pre-fills suggested weights based on your personal maxes (e.g. 80% of your back squat 1RM).
- **Fitness profile** — store your personal maxes and benchmarks (kg or reps), reused to suggest loads for future WODs.
- **Shared WOD, personal results** — the WOD is shared across all users for a given day; results and profile data are private per user (enforced with Supabase Row Level Security).

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com) for styling
- [Supabase](https://supabase.com) for auth, Postgres database, and Row Level Security
- [Anthropic API](https://docs.anthropic.com) (Claude) for extracting structured WOD data from images

> **Note:** this project pins a Next.js version with breaking changes relative to what most tooling/training data assumes. Before making framework-related changes, check the docs shipped in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## Getting started

### Prerequisites

- Node.js
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 3. Set up the database

Run the SQL in [`supabase/schema.sql`](supabase/schema.sql) against your Supabase project (SQL Editor or CLI). This creates the `workouts`, `results`, and `fitness_profile` tables with Row Level Security policies.

In your Supabase Auth settings, enable **email OTP / magic link** sign-in and add your local/deployed URL(s) to the allowed redirect URLs (the app redirects to `/auth/callback` after login).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use it

1. **Log in** — enter your email on the login page and click the magic link sent to your inbox.
2. **Add your fitness profile** (optional but recommended) — go to *Profilo* and enter your known maxes/benchmarks (e.g. back squat, deadlift, Fran time). Leave blank anything you haven't tested yet.
3. **Upload today's WOD** — on the home page, tap *Carica screenshot* and select one or more photos of the workout board. Claude extracts the structure automatically.
4. **Review / edit** — check the extracted text. Use *Modifica* to correct it, or *Sostituisci WOD* to upload different screenshots.
5. **Log your result** — tap *Registra risultato* and fill in the form for your score (weights/reps for strength, time for a for-time piece, rounds+reps for AMRAP, minutes completed for EMOM). Mark whether you did it RX and add notes if you scaled.

## Project structure

```
app/
  page.tsx                 Home page — today's WOD + result CTA
  login/, auth/callback/   Magic-link auth flow
  profile/                 Fitness profile page
  api/extract-wod/         Sends screenshots to Claude, stores parsed WOD
  api/update-wod/          Saves manual edits to the WOD text
  api/log-result/          Saves a logged result
  api/profile/             Saves fitness profile entries
components/                WodSection, ResultForm, ProfileForm, LogoutButton
lib/                       Supabase clients, shared types, profile presets
supabase/schema.sql        Database schema + RLS policies
```

## Deployment

The app is set up to deploy on [Vercel](https://vercel.com). Make sure the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`) are configured in the project settings, and that your Supabase Auth redirect URLs include the deployed domain.

# CrossFit Tracker

A mobile-first web app to track your daily CrossFit WOD (Workout Of the Day) and log your results. Upload a screenshot of the WOD board, let Claude extract the workout structure, then log your score with a form tailored to that workout's format (strength, for-time, AMRAP, EMOM).

## Features

- **Magic-link login** — no passwords, just email (via Supabase Auth).
- **WOD from a screenshot** — upload one or more photos of today's board; Claude (Anthropic API) reads them and turns them into structured data (movements, sets, reps, weights, time domains).
- **Edit / replace the WOD** — fix anything the AI got wrong, or swap in a different workout for the day.
- **Smart result logging** — the form adapts to the workout type and pre-fills suggested weights based on your personal maxes (e.g. 80% of your back squat 1RM).
- **Fitness profile with history** — log dated results for your personal maxes and benchmarks (kg, reps, or time); the most recent one is reused to suggest loads for future WODs, and the full history lets you track progress over time.
- **AI recommendations for today's WOD** — generate pacing/break/scaling advice and an expected-result estimate for the current WOD, personalized against your fitness profile.
- **Backfill past days** — navigate to any previous day (up to today) to add a WOD you missed logging and record its result, not just today's.
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

Run the SQL in [`supabase/schema.sql`](supabase/schema.sql) against your Supabase project (SQL Editor or CLI). This creates the `workouts`, `results`, `fitness_profile`, and `wod_recommendations` tables with Row Level Security policies.

If you already have an existing database, also run any new files under [`supabase/migrations/`](supabase/migrations/) you haven't applied yet, in order:
- `0001_fitness_profile_history.sql` — migrates `fitness_profile` from one row per benchmark to one row per dated result.
- `0002_wod_recommendations.sql` — adds the `wod_recommendations` table used by the AI recommendations feature.

In your Supabase Auth settings, enable **email OTP / magic link** sign-in and add your local/deployed URL(s) to the allowed redirect URLs (the app redirects to `/auth/callback` after login).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use it

1. **Log in** — enter your email on the login page and click the magic link sent to your inbox.
2. **Add your fitness profile** (optional but recommended) — go to *Profilo* and log a result for any max/benchmark you know (e.g. back squat, deadlift, Fran time). Each *+ Aggiungi* logs a new dated result rather than overwriting the last one, so *Storico* builds up a history you can use to see whether you're actually improving.
3. **Upload today's WOD** — on the home page, tap *Carica screenshot* and select one or more photos of the workout board. Claude extracts the structure automatically. Use the ‹ › arrows next to the date to go back to a previous day (e.g. to add a WOD you forgot to log yesterday) — you can't go past today.
4. **Review / edit** — check the extracted text. Use *Modifica* to correct it, or *Sostituisci WOD* to upload different screenshots.
5. **Get recommendations** — tap *✨ Consigli e risultato atteso* to have Claude generate pacing/scaling advice and an expected-result estimate for the WOD, based on your fitness profile. It's cached per WOD (so it isn't regenerated on every page load); use *Rigenera* to refresh it, e.g. after editing your profile or the WOD text.
6. **Log your result** — tap *Registra risultato* and fill in the form for your score (weights/reps for strength, time for a for-time piece, rounds+reps for AMRAP, minutes completed for EMOM). Mark whether you did it RX and add notes if you scaled.

## Project structure

```
app/
  page.tsx                 Home page — WOD for the selected day (?date=YYYY-MM-DD, defaults to today) + result CTA
  login/, auth/callback/   Magic-link auth flow
  profile/                 Fitness profile page
  api/extract-wod/         Sends screenshots to Claude, stores parsed WOD for a given date
  api/update-wod/          Saves manual edits to the WOD text
  api/log-result/          Saves a logged result
  api/profile/             Saves fitness profile entries
  api/wod-recommendation/  Generates & caches AI pacing/scaling advice for a WOD
components/                WodSection, DateNav, ResultForm, ProfileForm, WodRecommendation, TimeInput, LogoutButton
lib/                       Supabase clients, shared types, profile presets
supabase/schema.sql        Database schema + RLS policies
```

## Deployment

The app is set up to deploy on [Vercel](https://vercel.com). Make sure the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`) are configured in the project settings, and that your Supabase Auth redirect URLs include the deployed domain.

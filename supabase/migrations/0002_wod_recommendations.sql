-- Adds the wod_recommendations table: AI-generated pacing/scaling advice and
-- an expected-result estimate for a WOD, personalized from the user's fitness
-- profile. Run this once against an existing database (fresh installs get it
-- from supabase/schema.sql already).

create table wod_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  recommendations text not null,
  expected_result text not null,
  created_at timestamptz not null default now(),
  unique(user_id, workout_id)
);

alter table wod_recommendations enable row level security;

create policy "wod_recommendations_own" on wod_recommendations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

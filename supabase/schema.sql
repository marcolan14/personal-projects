-- workouts: WOD giornaliero (condiviso, non per-utente)
create table workouts (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  raw_text text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table workouts enable row level security;

-- Tutti gli utenti autenticati possono leggere i workout
create policy "workouts_select" on workouts
  for select to authenticated using (true);

-- Solo utenti autenticati possono inserire/modificare
create policy "workouts_insert" on workouts
  for insert to authenticated with check (true);

create policy "workouts_update" on workouts
  for update to authenticated using (true);


-- results: risultati personali dell'utente
create table results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  result text not null,
  rx boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table results enable row level security;

create policy "results_own" on results
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- fitness_profile: massimali e benchmark personali (coppie nome/valore)
create table fitness_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  value text not null,
  unit text,
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table fitness_profile enable row level security;

create policy "fitness_profile_own" on fitness_profile
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

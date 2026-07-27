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


-- fitness_profile: storico dei massimali e benchmark personali
-- (più risultati per indicatore, uno per data, per seguire i progressi nel tempo)
create table fitness_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  value text not null,
  unit text,
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, name, recorded_on)
);

alter table fitness_profile enable row level security;

create policy "fitness_profile_own" on fitness_profile
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- wod_recommendations: consigli e risultato atteso generati dall'AI per un WOD,
-- personalizzati sul profilo fitness dell'utente (una riga per utente+WOD)
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

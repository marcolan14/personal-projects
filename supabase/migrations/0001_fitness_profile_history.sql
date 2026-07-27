-- Turns fitness_profile from "one current value per benchmark" into a dated
-- history, so multiple results can be logged over time for the same benchmark.
-- Run this once against an existing database that already has the old schema
-- (fresh installs should just use the updated supabase/schema.sql instead).

alter table fitness_profile add column recorded_on date;
update fitness_profile set recorded_on = updated_at::date;
alter table fitness_profile alter column recorded_on set not null;
alter table fitness_profile alter column recorded_on set default current_date;

alter table fitness_profile rename column updated_at to created_at;

alter table fitness_profile drop constraint fitness_profile_user_id_name_key;
alter table fitness_profile add constraint fitness_profile_user_id_name_recorded_on_key
  unique (user_id, name, recorded_on);

-- Adds user feedback on how accurate the AI's pre-WOD recommendation/expected
-- result turned out to be, captured when logging a result. Fed back into
-- buildResultHistoryText so future recommendations can calibrate on it.
-- Run this once against an existing database (fresh installs get it from
-- supabase/schema.sql already).

alter table results add column prediction_rating text check (prediction_rating in ('too_easy', 'accurate', 'too_hard'));
alter table results add column prediction_feedback text;

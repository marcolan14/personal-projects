-- Adds a comment column to results: an AI-generated note comparing the
-- logged result against the WOD's expected_result (from wod_recommendations),
-- shown right after saving a result. Run this once against an existing
-- database (fresh installs get it from supabase/schema.sql already).

alter table results add column comment text;

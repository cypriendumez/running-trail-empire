-- Add per-user Intervals.icu credentials to profiles
alter table profiles
  add column if not exists intervals_athlete_id text,
  add column if not exists intervals_api_key    text;

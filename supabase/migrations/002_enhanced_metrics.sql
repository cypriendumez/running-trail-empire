-- ============================================================
-- Running & Trail Empire – Enhanced Metrics Schema
-- Adds sleep phases, body battery, power zones, weather history,
-- AI advice log, and Ghost Runner sessions
-- ============================================================

-- ─── SLEEP DATA (from Intervals.icu / Garmin) ─────────────────
create table sleep_data (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  date                date not null,
  total_sleep_min     integer not null check (total_sleep_min > 0),
  deep_sleep_min      integer default 0,
  light_sleep_min     integer default 0,
  rem_sleep_min       integer default 0,
  awake_min           integer default 0,
  sleep_score         smallint check (sleep_score >= 0 and sleep_score <= 100),
  body_battery_start  smallint check (body_battery_start >= 0 and body_battery_start <= 100),
  body_battery_end    smallint check (body_battery_end >= 0 and body_battery_end <= 100),
  respiration_rate    numeric(4,1),
  spo2_avg            numeric(4,1),
  source              text default 'intervals_icu',
  created_at          timestamptz default now(),
  unique (user_id, date)
);

alter table sleep_data enable row level security;
create policy "Users own sleep" on sleep_data for all using (auth.uid() = user_id);

-- ─── POWER ZONES (per workout) ────────────────────────────────
create table power_zone_distribution (
  id              uuid primary key default uuid_generate_v4(),
  workout_id      uuid not null references workouts(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  z1_seconds      integer default 0,
  z2_seconds      integer default 0,
  z3_seconds      integer default 0,
  z4_seconds      integer default 0,
  z5_seconds      integer default 0,
  z6_seconds      integer default 0,
  hr_z1_seconds   integer default 0,
  hr_z2_seconds   integer default 0,
  hr_z3_seconds   integer default 0,
  hr_z4_seconds   integer default 0,
  hr_z5_seconds   integer default 0,
  aerobic_te      numeric(3,1),
  anaerobic_te    numeric(3,1),
  created_at      timestamptz default now()
);

alter table power_zone_distribution enable row level security;
create policy "Users own power zones" on power_zone_distribution for all using (auth.uid() = user_id);

-- ─── WEATHER HISTORY (per workout session) ───────────────────
create table workout_weather (
  id                  uuid primary key default uuid_generate_v4(),
  workout_id          uuid not null references workouts(id) on delete cascade,
  user_id             uuid not null references profiles(id) on delete cascade,
  temperature_c       numeric(4,1),
  feels_like_c        numeric(4,1),
  humidity_pct        smallint,
  wind_speed_kmh      numeric(5,1),
  wind_direction_deg  smallint,
  precipitation_mm    numeric(4,1) default 0,
  cloud_cover_pct     smallint,
  visibility_km       numeric(4,1),
  uv_index            smallint,
  weather_condition   text,
  weather_icon        text,
  altitude_m          integer,
  performance_impact  text check (performance_impact in ('positive','neutral','negative')),
  impact_notes        text,
  fetched_at          timestamptz default now()
);

alter table workout_weather enable row level security;
create policy "Users own workout weather" on workout_weather for all using (auth.uid() = user_id);

-- ─── AI ADVICE LOG (Gemini + Claude Pro) ─────────────────────
create table ai_advice (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  week_start      date not null,
  gemini_report   text,
  gemini_json     jsonb,
  coach_advice    text,
  advice_author   text default 'gemini' check (advice_author in ('gemini','claude_pro')),
  published       boolean default false,
  published_at    timestamptz,
  created_at      timestamptz default now()
);

alter table ai_advice enable row level security;
create policy "Users read own advice" on ai_advice for select using (auth.uid() = user_id);
create policy "Service role manages advice" on ai_advice for all using (true) with check (true);

-- ─── GHOST RUNNER SESSIONS ────────────────────────────────────
create table ghost_runner_sessions (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references profiles(id) on delete cascade,
  race_id               uuid references races(id),
  route_name            text,
  target_seconds        integer not null,
  actual_seconds        integer,
  distance_km           numeric(7,3) not null,
  elevation_gain_m      integer default 0,
  checkpoints           jsonb,
  audio_cues_enabled    boolean default true,
  completed             boolean default false,
  session_date          date not null default current_date,
  created_at            timestamptz default now()
);

alter table ghost_runner_sessions enable row level security;
create policy "Users own ghost sessions" on ghost_runner_sessions for all using (auth.uid() = user_id);

-- ─── SMART JOURNAL ENTRIES ────────────────────────────────────
create table journal_entries (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  workout_id          uuid references workouts(id),
  entry_date          date not null default current_date,
  raw_text            text not null,
  audio_transcript    text,
  mental_fatigue      smallint check (mental_fatigue >= 0 and mental_fatigue <= 10),
  motivation_score    smallint check (motivation_score >= 0 and motivation_score <= 10),
  stress_level        smallint check (stress_level >= 0 and stress_level <= 10),
  sentiment           text check (sentiment in ('positive','neutral','negative')),
  keywords            text[],
  ai_insights         text,
  created_at          timestamptz default now()
);

alter table journal_entries enable row level security;
create policy "Users own journal" on journal_entries for all using (auth.uid() = user_id);

-- ─── CALENDAR EVENTS (Google/Outlook sync) ────────────────────
create table calendar_events (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  external_id     text,
  title           text not null,
  event_date      date not null,
  duration_min    integer default 60,
  stress_weight   smallint default 1 check (stress_weight between 1 and 5),
  source          text default 'manual' check (source in ('manual','google','outlook')),
  synced_at       timestamptz default now()
);

alter table calendar_events enable row level security;
create policy "Users own calendar events" on calendar_events for all using (auth.uid() = user_id);

-- ─── INDEXES ──────────────────────────────────────────────────
create index idx_sleep_user_date on sleep_data (user_id, date desc);
create index idx_power_zones_workout on power_zone_distribution (workout_id);
create index idx_weather_workout on workout_weather (workout_id);
create index idx_ai_advice_user_week on ai_advice (user_id, week_start desc);
create index idx_ghost_sessions_user on ghost_runner_sessions (user_id, session_date desc);
create index idx_journal_user_date on journal_entries (user_id, entry_date desc);
create index idx_calendar_user_date on calendar_events (user_id, event_date);

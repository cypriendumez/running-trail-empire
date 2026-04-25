-- ============================================================
-- Running & Trail Empire – Initial Schema
-- Supabase / PostgreSQL with strict RLS
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- ─── ENUMS ──────────────────────────────────────────────────
create type subscription_tier as enum ('free', 'pro', 'elite');
create type user_mode as enum ('ludique', 'elite');
create type physiological_state as enum ('recovery', 'optimal', 'competition');
create type chronotype as enum ('morning', 'evening', 'neutral');
create type hormonal_phase as enum ('follicular', 'ovulatory', 'luteal', 'menstrual');
create type league_tier as enum ('bronze', 'silver', 'gold', 'platinum', 'diamond');
create type workout_type as enum ('easy','tempo','interval','long_run','race','recovery','strength','trail','vma','hill_repeat');
create type race_type as enum ('road_5k','road_10k','semi','marathon','trail_s','trail_m','trail_l','trail_xl','ultra');
create type trail_difficulty as enum ('green','blue','red','black');
create type body_part as enum ('head','neck','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','chest','upper_back','lower_back','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle','left_foot','right_foot','left_calf','right_calf','left_hamstring','right_hamstring','left_quad','right_quad','left_it_band','right_it_band');
create type injury_stage as enum ('acute','subacute','chronic','healed');
create type wearable_source as enum ('manual','garmin','coros','strava','apple_health','polar');

-- ─── PROFILES ────────────────────────────────────────────────
create table profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  email                     text unique not null,
  full_name                 text not null,
  avatar_url                text,
  age                       smallint check (age > 0 and age < 120),
  height_cm                 smallint check (height_cm > 100 and height_cm < 250),
  weight_kg                 numeric(5,2) check (weight_kg > 30 and weight_kg < 300),
  gender                    text check (gender in ('male','female','other')),
  chronotype                chronotype default 'neutral',
  mode                      user_mode default 'ludique',
  subscription_tier         subscription_tier default 'free',
  stripe_customer_id        text unique,
  stripe_subscription_id    text unique,
  discipline_score          numeric(5,2) default 0 check (discipline_score >= 0 and discipline_score <= 100),
  league                    league_tier default 'bronze',
  xp_points                 integer default 0,
  is_female_cycle_sync      boolean default false,
  current_phase             hormonal_phase,
  emergency_contact_name    text,
  emergency_contact_phone   text,
  guardian_mode_enabled     boolean default false,
  onboarding_completed      boolean default false,
  preferred_language        text default 'fr',
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ─── PERFORMANCE BASELINE ────────────────────────────────────
create table performance_baselines (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  vma_kmh         numeric(4,2) not null,
  ftp_watts       smallint,
  max_hr          smallint not null,
  resting_hr      smallint not null,
  lt_hr           smallint,     -- lactate threshold HR
  z1_min          numeric(4,2), -- pace zones (min/km)
  z1_max          numeric(4,2),
  z2_min          numeric(4,2),
  z2_max          numeric(4,2),
  z3_min          numeric(4,2),
  z3_max          numeric(4,2),
  z4_min          numeric(4,2),
  z4_max          numeric(4,2),
  z5_min          numeric(4,2),
  z5_max          numeric(4,2),
  tested_at       date not null default current_date,
  created_at      timestamptz default now()
);

-- ─── HRV DATA ────────────────────────────────────────────────
create table hrv_data (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references profiles(id) on delete cascade,
  date                  date not null,
  hrv_ms                numeric(6,2) not null,
  rmssd                 numeric(6,2),
  sdnn                  numeric(6,2),
  physiological_state   physiological_state not null,
  notes                 text,
  created_at            timestamptz default now(),
  unique (user_id, date)
);

-- ─── WORKOUTS ────────────────────────────────────────────────
create table workouts (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references profiles(id) on delete cascade,
  title                   text not null,
  type                    workout_type not null,
  date                    date not null,
  duration_seconds        integer not null check (duration_seconds > 0),
  distance_km             numeric(7,3),
  elevation_gain_m        smallint default 0,
  elevation_loss_m        smallint default 0,
  avg_hr                  smallint,
  max_hr                  smallint,
  avg_pace_min_km         numeric(5,2),
  avg_power_watts         smallint,
  max_power_watts         smallint,
  avg_cadence_spm         smallint,
  tss                     numeric(6,2),
  training_effect         numeric(3,1),
  cardiac_decoupling      numeric(5,2),
  avg_ascent_speed_mh     smallint,
  cadence_spm             smallint,
  vertical_oscillation_cm numeric(4,2),
  ground_contact_ms       smallint,
  stride_length_m         numeric(4,3),
  gpx_url                 text,
  weather_temp_c          numeric(4,1),
  weather_humidity        smallint,
  weather_wind_kmh        smallint,
  weather_altitude_m      smallint,
  pace_adj_percent        numeric(4,2),
  notes                   text,
  source                  wearable_source default 'manual',
  shoe_id                 uuid,
  created_at              timestamptz default now()
);

-- ─── TRAINING PLANS ──────────────────────────────────────────
create table training_plans (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  race_id         uuid,
  name            text not null,
  start_date      date not null,
  race_date       date not null,
  weekly_km       numeric(5,1),
  target_seconds  integer,
  plan_json       jsonb not null default '{}',
  created_by      text check (created_by in ('user','ai')) default 'ai',
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ─── RACES ───────────────────────────────────────────────────
create table races (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  type                  race_type not null,
  region                text not null,
  department            text not null,
  city                  text,
  date                  date not null,
  distance_km           numeric(7,3) not null,
  elevation_gain_m      smallint default 0,
  max_participants      integer,
  difficulty            trail_difficulty default 'green',
  terrain               text[] default '{}',
  time_limits           jsonb default '[]',
  registration_url      text,
  gpx_url               text,
  altitude_profile_url  text,
  historical_weather    jsonb,
  organization          text,
  description           text,
  latitude              numeric(10,7),
  longitude             numeric(10,7),
  location              geometry(Point, 4326),
  edition               smallint,
  is_itra_certified     boolean default false,
  itra_points           smallint,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index races_location_idx on races using gist(location);
create index races_date_idx on races(date);
create index races_type_idx on races(type);
create index races_region_idx on races(region);

-- ─── RACE RESULTS ────────────────────────────────────────────
create table race_results (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  race_id             uuid not null references races(id),
  finish_seconds      integer,
  position_overall    integer,
  position_category   integer,
  total_participants  integer,
  dnf                 boolean default false,
  segment_times       jsonb default '[]',
  notes               text,
  created_at          timestamptz default now()
);

-- ─── SHOES ───────────────────────────────────────────────────
create table shoes (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  brand           text not null,
  model           text not null,
  version         text,
  purchase_date   date not null,
  km_at_purchase  numeric(7,2) default 0,
  current_km      numeric(7,2) default 0,
  max_km          smallint default 600,
  color           text,
  image_url       text,
  is_active       boolean default true,
  terrain         text check (terrain in ('road','trail','mixed')) default 'road',
  drop_mm         smallint,
  stack_mm        smallint,
  weight_g        smallint,
  notes           text,
  created_at      timestamptz default now()
);

-- ─── PHYSIO REPORTS ──────────────────────────────────────────
create table physio_reports (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  body_part       body_part not null,
  pain_level      smallint check (pain_level between 1 and 10),
  pain_type       text check (pain_type in ('sharp','dull','burning','stiffness','weakness')),
  when_occurs     text check (when_occurs in ('at_rest','during_run','after_run','always')),
  stage           injury_stage default 'acute',
  diagnosis       text,
  rehab_exercises jsonb default '[]',
  is_resolved     boolean default false,
  reported_at     timestamptz default now()
);

-- ─── TRAIL ROUTES ────────────────────────────────────────────
create table trail_routes (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references profiles(id) on delete set null,
  name              text not null,
  description       text,
  distance_km       numeric(7,3) not null,
  elevation_gain_m  smallint not null default 0,
  elevation_loss_m  smallint not null default 0,
  max_altitude_m    smallint,
  min_altitude_m    smallint,
  difficulty        trail_difficulty default 'green',
  terrain_types     text[] default '{}',
  gpx_data          text,
  geojson           jsonb,
  start_lat         numeric(10,7),
  start_lng         numeric(10,7),
  start_location    geometry(Point, 4326),
  region            text,
  is_loop           boolean default true,
  estimated_min     smallint,
  surface_quality   text check (surface_quality in ('excellent','good','rough','technical')),
  is_public         boolean default false,
  synced_garmin     boolean default false,
  synced_coros      boolean default false,
  created_at        timestamptz default now()
);

-- ─── DISCIPLINE SCORE ────────────────────────────────────────
create table discipline_scores (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references profiles(id) on delete cascade,
  week_start          date not null,
  week_end            date not null,
  score_total         numeric(5,2),
  score_precision     numeric(5,2),
  score_consistency   numeric(5,2),
  score_recovery      numeric(5,2),
  sessions_planned    smallint,
  sessions_completed  smallint,
  calculated_at       timestamptz default now(),
  unique (user_id, week_start)
);

-- ─── LEAGUES ─────────────────────────────────────────────────
create table leagues (
  id          uuid primary key default uuid_generate_v4(),
  tier        league_tier not null,
  name        text not null,
  week_start  date not null,
  week_end    date not null,
  rewards     text[] default '{}',
  created_at  timestamptz default now()
);

create table league_members (
  league_id   uuid references leagues(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  score       numeric(5,2) default 0,
  rank        smallint,
  primary key (league_id, user_id)
);

-- ─── BADGES ──────────────────────────────────────────────────
create table badges (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  icon        text not null,
  rarity      text check (rarity in ('common','rare','epic','legendary')),
  condition   jsonb not null
);

create table user_badges (
  user_id       uuid references profiles(id) on delete cascade,
  badge_id      uuid references badges(id),
  progress      smallint default 0,
  max_progress  smallint default 1,
  unlocked_at   timestamptz,
  primary key (user_id, badge_id)
);

-- ─── TEAM CHALLENGES ─────────────────────────────────────────
create table team_challenges (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  route_name      text,
  total_km        numeric(7,3),
  current_km      numeric(7,3) default 0,
  end_date        date,
  gpx_url         text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

create table challenge_members (
  challenge_id  uuid references team_challenges(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  km_contributed numeric(7,3) default 0,
  primary key (challenge_id, user_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ─── RLS POLICIES ────────────────────────────────────────────
alter table profiles enable row level security;
alter table performance_baselines enable row level security;
alter table hrv_data enable row level security;
alter table workouts enable row level security;
alter table training_plans enable row level security;
alter table race_results enable row level security;
alter table shoes enable row level security;
alter table physio_reports enable row level security;
alter table trail_routes enable row level security;
alter table discipline_scores enable row level security;
alter table league_members enable row level security;
alter table user_badges enable row level security;
alter table notifications enable row level security;

-- Profiles: users can only access their own profile
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- Workouts: own data only
create policy "workouts_all_own" on workouts for all using (auth.uid() = user_id);

-- HRV: own data only
create policy "hrv_all_own" on hrv_data for all using (auth.uid() = user_id);

-- Training plans: own data only
create policy "plans_all_own" on training_plans for all using (auth.uid() = user_id);

-- Races: public read
alter table races enable row level security;
create policy "races_public_read" on races for select using (true);

-- Shoes: own data only
create policy "shoes_all_own" on shoes for all using (auth.uid() = user_id);

-- Physio reports: own data only
create policy "physio_all_own" on physio_reports for all using (auth.uid() = user_id);

-- Trail routes: own or public
create policy "routes_select" on trail_routes for select using (auth.uid() = user_id or is_public = true);
create policy "routes_mutate_own" on trail_routes for all using (auth.uid() = user_id);

-- Notifications: own data only
create policy "notifs_all_own" on notifications for all using (auth.uid() = user_id);

-- ─── FUNCTIONS ───────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Update shoe km when workout completed
create or replace function update_shoe_km()
returns trigger language plpgsql as $$
begin
  if new.shoe_id is not null and new.distance_km is not null then
    update shoes set current_km = current_km + new.distance_km where id = new.shoe_id;
  end if;
  return new;
end;
$$;

create trigger after_workout_insert
  after insert on workouts
  for each row execute function update_shoe_km();

-- Compute discipline score weekly
create or replace function compute_discipline_score(p_user_id uuid, p_week_start date)
returns numeric language plpgsql as $$
declare
  v_precision  numeric;
  v_consistency numeric;
  v_recovery   numeric;
  v_total      numeric;
begin
  -- Precision: % sessions completed on target pace ±5%
  select coalesce(
    count(*) filter (where abs(coalesce(cardiac_decoupling,0)) < 5) * 100.0 / nullif(count(*), 0),
    50
  ) into v_precision
  from workouts
  where user_id = p_user_id
    and date >= p_week_start
    and date < p_week_start + 7;

  -- Consistency: sessions / planned sessions (from training plan)
  v_consistency := 75; -- placeholder, computed from plan comparison

  -- Recovery: based on HRV trend
  select coalesce(avg(case when physiological_state = 'optimal' then 100
                           when physiological_state = 'recovery' then 50
                           else 25 end), 50)
  into v_recovery
  from hrv_data
  where user_id = p_user_id
    and date >= p_week_start
    and date < p_week_start + 7;

  v_total := (v_precision * 0.4) + (v_consistency * 0.4) + (v_recovery * 0.2);

  insert into discipline_scores (user_id, week_start, week_end, score_total, score_precision, score_consistency, score_recovery)
  values (p_user_id, p_week_start, p_week_start + 6, v_total, v_precision, v_consistency, v_recovery)
  on conflict (user_id, week_start) do update
    set score_total = excluded.score_total,
        score_precision = excluded.score_precision,
        score_consistency = excluded.score_consistency,
        score_recovery = excluded.score_recovery,
        calculated_at = now();

  -- Update profile discipline score
  update profiles set discipline_score = v_total where id = p_user_id;

  return v_total;
end;
$$;

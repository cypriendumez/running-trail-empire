-- ============================================================
--  006 · Parcours utilisateurs + parcours communautaires + avis
--  Idempotent (if not exists / drop policy if exists) — safe to re-run.
-- ============================================================

-- ─── USER ROUTES (parcours sauvegardés par chaque utilisateur) ───────────────
create table if not exists user_routes (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  name              text not null,
  coordinates       jsonb not null,                 -- [[lng,lat], ...]
  distance_km       numeric(8,2) not null default 0,
  elevation_gain_m  integer not null default 0,
  duration_min      integer not null default 0,
  difficulty        text not null default 'green' check (difficulty in ('green','blue','red','black')),
  created_at        timestamptz default now()
);
create index if not exists idx_user_routes_user on user_routes(user_id);

alter table user_routes enable row level security;
drop policy if exists "own routes select" on user_routes;
drop policy if exists "own routes insert" on user_routes;
drop policy if exists "own routes update" on user_routes;
drop policy if exists "own routes delete" on user_routes;
create policy "own routes select" on user_routes for select using (auth.uid() = user_id);
create policy "own routes insert" on user_routes for insert with check (auth.uid() = user_id);
create policy "own routes update" on user_routes for update using (auth.uid() = user_id);
create policy "own routes delete" on user_routes for delete using (auth.uid() = user_id);

-- ─── COMMUNITY ROUTES (parcours partagés à toute la communauté) ──────────────
create table if not exists community_routes (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  author_name       text not null default 'Coureur',
  name              text not null,
  sport             text not null check (sport in ('course','trail','velo','marche')),
  coordinates       jsonb not null,                 -- [[lng,lat], ...]
  distance_km       numeric(8,2) not null default 0,
  elevation_gain_m  integer not null default 0,
  duration_min      integer not null default 0,
  difficulty        text not null default 'green' check (difficulty in ('green','blue','red','black')),
  region            text default '',
  city              text default '',
  lat               double precision not null,
  lng               double precision not null,
  description       text default '',
  is_public         boolean not null default true,
  created_at        timestamptz default now()
);
create index if not exists idx_community_routes_sport on community_routes(sport);
create index if not exists idx_community_routes_public on community_routes(is_public);

alter table community_routes enable row level security;
drop policy if exists "community read public" on community_routes;
drop policy if exists "community insert own" on community_routes;
drop policy if exists "community update own" on community_routes;
drop policy if exists "community delete own" on community_routes;
create policy "community read public" on community_routes for select using (is_public or auth.uid() = user_id);
create policy "community insert own" on community_routes for insert with check (auth.uid() = user_id);
create policy "community update own" on community_routes for update using (auth.uid() = user_id);
create policy "community delete own" on community_routes for delete using (auth.uid() = user_id);

-- ─── ROUTE REVIEWS (avis & notes — sur catalogue OU parcours communautaires) ──
-- route_ref = identifiant texte : un id de catalogue (ex "tr-gr20") ou un uuid communautaire.
create table if not exists route_reviews (
  id            uuid primary key default uuid_generate_v4(),
  route_ref     text not null,
  user_id       uuid not null references profiles(id) on delete cascade,
  author_name   text not null default 'Coureur',
  rating        smallint not null check (rating between 1 and 5),
  comment       text default '',
  created_at    timestamptz default now(),
  unique (route_ref, user_id)               -- un seul avis par utilisateur et par parcours
);
create index if not exists idx_route_reviews_ref on route_reviews(route_ref);

alter table route_reviews enable row level security;
drop policy if exists "reviews read all" on route_reviews;
drop policy if exists "reviews insert own" on route_reviews;
drop policy if exists "reviews update own" on route_reviews;
drop policy if exists "reviews delete own" on route_reviews;
create policy "reviews read all" on route_reviews for select using (true);
create policy "reviews insert own" on route_reviews for insert with check (auth.uid() = user_id);
create policy "reviews update own" on route_reviews for update using (auth.uid() = user_id);
create policy "reviews delete own" on route_reviews for delete using (auth.uid() = user_id);

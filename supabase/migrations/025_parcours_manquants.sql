-- ─────────────────────────────────────────────────────────────────────────────
--  025 — LES TABLES DE PARCOURS N'AVAIENT JAMAIS ÉTÉ CRÉÉES.
--
--  DÉCOUVERT EN EXÉCUTANT LA MIGRATION 024, qui a échoué sur :
--      ERROR 42P01: relation "user_routes" does not exist
--
--  Vérification faite ensuite sur les 42 tables déclarées par l'ensemble des
--  migrations : 3 manquent, toutes issues de la 006, jamais exécutée.
--      user_routes       — parcours enregistrés dans le Trail Builder
--      community_routes  — parcours partagés à la communauté
--      route_reviews     — avis et notes sur les parcours
--
--  ⚠️ CE QUE ÇA VEUT DIRE POUR L'ATHLÈTE, ET POURQUOI PERSONNE NE L'A VU.
--  Le Trail Builder tente d'écrire en base ; en cas d'échec il bascule sur le
--  `localStorage` du navigateur ET AFFICHE UN MESSAGE DE SUCCÈS. Les parcours
--  « enregistrés » vivent donc dans un seul navigateur : perdus au vidage du cache,
--  invisibles depuis le téléphone, absents de toute sauvegarde. Un repli silencieux
--  qui se félicite est pire qu'une erreur franche — c'est exactement le défaut que ce
--  projet traque, et il aura tenu des mois.
--
--  Cette migration reprend le contenu de la 006 SANS ses douze instructions DROP
--  (l'éditeur Supabase les signale comme destructives), et y ajoute directement la
--  colonne `is_favorite` de la 024 : une seule exécution suffit.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. PARCOURS ENREGISTRÉS PAR L'ATHLÈTE ───────────────────────────────────
create table if not exists user_routes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  name              text not null,
  coordinates       jsonb not null,                 -- [[lng,lat], ...]
  distance_km       numeric(8,2) not null default 0,
  elevation_gain_m  integer not null default 0,
  duration_min      integer not null default 0,
  difficulty        text not null default 'green' check (difficulty in ('green','blue','red','black')),
  -- Le cœur (ex-migration 024) : les favoris remontent en tête de liste.
  is_favorite       boolean not null default false,
  created_at        timestamptz default now()
);
-- Colonne ajoutée séparément aussi, pour le cas où la table aurait été créée entre
-- temps sans elle : `if not exists` rend l'instruction sans effet dans le cas normal.
alter table user_routes add column if not exists is_favorite boolean not null default false;

create index if not exists idx_user_routes_user on user_routes(user_id);
-- Les favoris d'abord, puis les plus récents — l'index suit exactement le tri de l'écran.
create index if not exists idx_user_routes_favoris
  on user_routes (user_id, is_favorite desc, created_at desc);

alter table user_routes enable row level security;

-- ─── 2. PARCOURS PARTAGÉS À LA COMMUNAUTÉ ────────────────────────────────────
create table if not exists community_routes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  author_name       text not null default 'Coureur',
  name              text not null,
  sport             text not null check (sport in ('course','trail','velo','marche')),
  coordinates       jsonb not null,
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

-- ─── 3. AVIS SUR LES PARCOURS ────────────────────────────────────────────────
-- `route_ref` est un identifiant TEXTE : un parcours du catalogue (« tr-gr20 ») ou
-- l'uuid d'un parcours communautaire.
create table if not exists route_reviews (
  id            uuid primary key default gen_random_uuid(),
  route_ref     text not null,
  user_id       uuid not null references profiles(id) on delete cascade,
  author_name   text not null default 'Coureur',
  rating        smallint not null check (rating between 1 and 5),
  comment       text default '',
  created_at    timestamptz default now(),
  unique (route_ref, user_id)      -- un seul avis par athlète et par parcours
);
create index if not exists idx_route_reviews_ref on route_reviews(route_ref);

alter table route_reviews enable row level security;

-- ─── 4. LES POLITIQUES, SANS AUCUN DROP ──────────────────────────────────────
-- `create policy` échoue si la politique existe déjà, et la 006 réglait ça par des
-- `drop policy if exists` — que l'éditeur Supabase signale comme destructifs. Le bloc
-- ci-dessous obtient le même caractère rejouable en ignorant l'erreur « existe déjà »,
-- sans jamais rien supprimer.
do $$
begin
  begin create policy "own routes select" on user_routes for select using (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "own routes insert" on user_routes for insert with check (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "own routes update" on user_routes for update using (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "own routes delete" on user_routes for delete using (auth.uid() = user_id);
  exception when duplicate_object then null; end;

  -- Un parcours communautaire est lisible s'il est public, ou par son auteur.
  begin create policy "community read public" on community_routes for select using (is_public or auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "community insert own" on community_routes for insert with check (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "community update own" on community_routes for update using (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "community delete own" on community_routes for delete using (auth.uid() = user_id);
  exception when duplicate_object then null; end;

  -- Les avis sont lisibles par tous : c'est leur objet même.
  begin create policy "reviews read all" on route_reviews for select using (true);
  exception when duplicate_object then null; end;
  begin create policy "reviews insert own" on route_reviews for insert with check (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "reviews update own" on route_reviews for update using (auth.uid() = user_id);
  exception when duplicate_object then null; end;
  begin create policy "reviews delete own" on route_reviews for delete using (auth.uid() = user_id);
  exception when duplicate_object then null; end;
end $$;

-- ─── 5. DROITS PAR RÔLE ──────────────────────────────────────────────────────
-- Leçon de la migration 023 : `revoke ... from public` ne retire PAS la concession
-- que Supabase accorde d'office au rôle `anon`. Il faut le nommer.
--
-- `user_routes` est STRICTEMENT personnelle : un visiteur non connecté n'a rien à y
-- faire. On la lui ferme, en plus de la RLS qui protège déjà chaque ligne.
revoke all on public.user_routes from anon;

-- `community_routes` et `route_reviews`, EN REVANCHE, restent lisibles sans compte —
-- et c'est délibéré : leurs politiques disent déjà `is_public` et `using (true)`, et
-- `GET /api/community/routes` ne demande aucune authentification. Les fermer à `anon`
-- ferait taire cette route en silence : elle avale l'erreur et renvoie une liste vide.
-- On ne referme pas une porte que l'application ouvre volontairement.

grant select, insert, update, delete on public.user_routes to authenticated;
grant select, insert, update, delete on public.community_routes to authenticated;
grant select, insert, update, delete on public.route_reviews to authenticated;

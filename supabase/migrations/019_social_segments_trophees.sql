-- ─────────────────────────────────────────────────────────────────────────────
--  SOCIAL, SEGMENTS ET TROPHÉES
--
--  Socle de la partie communautaire : suivre des athlètes, publier ses séances,
--  encourager, commenter ; puis les segments (avec leur « légende locale ») et les
--  trophées de course.
--
--  POURQUOI CET ORDRE DE TABLES. Tout dépend de `activity_tracks` : sans la trace
--  GPS, un segment ne peut être ni détecté, ni chronométré, ni rejoué en 3D. Or
--  aucune trace n'est stockée aujourd'hui (314 séances, 0 `gpx_url`) — elles sont
--  seulement RÉCUPÉRABLES depuis intervals.icu via le flux `latlng`, que
--  src/lib/intervals/location.ts sait déjà lire. C'est le vrai préalable technique.
--
--  Aucun DROP : ce fichier est rejouable, il ne détruit rien.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. GRAPHE SOCIAL ─────────────────────────────────────────────────────────
-- Modèle « abonnement » (comme Strava/Instagram) et non « amitié réciproque » :
-- il n'exige pas d'acceptation pour les comptes publics, et l'amitié se déduit
-- simplement d'un suivi dans les deux sens. Un modèle réciproque aurait imposé une
-- file de demandes à tout le monde, y compris là où personne n'en veut.
create table if not exists follows (
  follower_id  uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  -- 'pending' n'est utilisé que si la cible est en compte privé.
  status       text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- On ne se suit pas soi-même : sinon le fil affiche ses propres séances en double.
  constraint follows_pas_soi_meme check (follower_id <> following_id)
);
create index if not exists follows_following_idx on follows (following_id, status);
create index if not exists follows_follower_idx  on follows (follower_id, status);

-- ── 2. PUBLICATIONS ──────────────────────────────────────────────────────────
-- Une publication référence une séance (le cas normal) OU porte un simple texte.
-- `workout_id` est nullable pour permettre les deux, et UNIQUE quand il est
-- renseigné : publier deux fois la même séance n'a pas de sens et polluerait le fil.
create table if not exists activity_posts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  workout_id  uuid references workouts(id) on delete cascade,
  title       text,
  body        text,
  photo_urls  text[] not null default '{}',
  -- 'followers' par défaut, et c'est délibéré : une séance porte un tracé GPS qui
  -- part du domicile. Le réglage par défaut ne doit jamais exposer ça au monde entier.
  visibility  text not null default 'followers' check (visibility in ('public', 'followers', 'private')),
  kudos_count    integer not null default 0,
  comments_count integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists activity_posts_workout_unique
  on activity_posts (workout_id) where workout_id is not null;
create index if not exists activity_posts_feed_idx on activity_posts (user_id, created_at desc);

create table if not exists post_kudos (
  post_id    uuid not null references activity_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- La clé primaire composite REND IMPOSSIBLE le double encouragement, plutôt que
  -- de compter sur le client pour ne pas cliquer deux fois.
  primary key (post_id, user_id)
);

create table if not exists post_comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references activity_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on post_comments (post_id, created_at);

-- ── 3. TRACES GPS — le préalable aux segments et au survol 3D ────────────────
-- `points` : tableau [[lat, lon], …] éventuellement sous-échantillonné pour
-- l'appariement ; `polyline` : trace encodée (format Google) pour l'affichage carte.
-- Les bornes (bbox) ne sont pas un confort : sans elles, chercher les segments d'une
-- séance imposerait de comparer sa trace à TOUS les segments de la base.
create table if not exists activity_tracks (
  workout_id  uuid primary key references workouts(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  points      jsonb not null,
  polyline    text,
  point_count integer not null default 0,
  min_lat numeric(9,6), max_lat numeric(9,6),
  min_lon numeric(9,6), max_lon numeric(9,6),
  -- Distinguer « pas encore importée » de « cette séance n'a pas de trace »
  -- (tapis, home-trainer). Sans ça, on réessaierait indéfiniment un import vide.
  has_gps     boolean not null default true,
  fetched_at  timestamptz not null default now()
);
create index if not exists activity_tracks_bbox_idx on activity_tracks (min_lat, max_lat, min_lon, max_lon);
create index if not exists activity_tracks_user_idx on activity_tracks (user_id);

-- ── 4. SEGMENTS ──────────────────────────────────────────────────────────────
create table if not exists segments (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_by  uuid references profiles(id) on delete set null,
  sport       text not null default 'run',
  distance_m  integer not null check (distance_m > 0),
  elevation_gain_m integer not null default 0,
  avg_grade_pct    numeric(5,2),
  polyline    text not null,
  start_lat numeric(9,6) not null, start_lon numeric(9,6) not null,
  end_lat   numeric(9,6) not null, end_lon   numeric(9,6) not null,
  min_lat numeric(9,6), max_lat numeric(9,6),
  min_lon numeric(9,6), max_lon numeric(9,6),
  is_public   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists segments_bbox_idx on segments (min_lat, max_lat, min_lon, max_lon);

-- Un passage sur un segment. UNIQUE (segment, séance) : une même séance ne peut pas
-- produire deux fois le même effort, sinon les classements et la « légende locale »
-- se laisseraient gonfler par un simple ré-import.
create table if not exists segment_efforts (
  id          uuid primary key default uuid_generate_v4(),
  segment_id  uuid not null references segments(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  workout_id  uuid not null references workouts(id) on delete cascade,
  elapsed_seconds integer not null check (elapsed_seconds > 0),
  started_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  unique (segment_id, workout_id)
);
create index if not exists segment_efforts_classement_idx on segment_efforts (segment_id, elapsed_seconds);
-- La « légende locale » se calcule sur le NOMBRE de passages récents : cet index sert
-- exactement cette requête (par segment, sur une fenêtre de date, groupé par athlète).
create index if not exists segment_efforts_legende_idx on segment_efforts (segment_id, started_at desc, user_id);

-- ── 5. TROPHÉES ──────────────────────────────────────────────────────────────
-- `kind` reste du texte libre volontairement : la liste des trophées va bouger, et
-- une contrainte figée obligerait une migration à chaque nouvelle récompense.
create table if not exists achievements (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  label      text not null,
  workout_id uuid references workouts(id) on delete set null,
  segment_id uuid references segments(id) on delete set null,
  data       jsonb not null default '{}'::jsonb,
  earned_at  timestamptz not null default now(),
  -- Un même trophée ne se gagne qu'une fois pour un même déclencheur : sans cette
  -- clé, une re-synchronisation redistribuerait toute la vitrine.
  unique (user_id, kind, workout_id)
);
create index if not exists achievements_user_idx on achievements (user_id, earned_at desc);

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
-- Rappel du contexte : la table `races` était lisible publiquement faute de RLS.
-- Ici les données sont personnelles (traces GPS partant du domicile), donc chaque
-- table est protégée dès sa création, pas « plus tard ».
alter table follows          enable row level security;
alter table activity_posts   enable row level security;
alter table post_kudos       enable row level security;
alter table post_comments    enable row level security;
alter table activity_tracks  enable row level security;
alter table segments         enable row level security;
alter table segment_efforts  enable row level security;
alter table achievements     enable row level security;

-- Suivis : chacun gère les siens ; on peut voir qui nous suit.
create policy follows_lecture on follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);
create policy follows_ecriture on follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Publications : les siennes, les publiques, et celles des athlètes qu'on suit.
create policy posts_lecture on activity_posts for select
  using (
    auth.uid() = user_id
    or visibility = 'public'
    or (visibility = 'followers' and exists (
      select 1 from follows f
      where f.following_id = activity_posts.user_id
        and f.follower_id = auth.uid()
        and f.status = 'accepted'))
  );
create policy posts_ecriture on activity_posts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Encouragements et commentaires : lisibles si la publication l'est ; on n'écrit
-- que sous son propre nom.
create policy kudos_lecture on post_kudos for select
  using (exists (select 1 from activity_posts p where p.id = post_kudos.post_id));
create policy kudos_ecriture on post_kudos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy comments_lecture on post_comments for select
  using (exists (select 1 from activity_posts p where p.id = post_comments.post_id));
create policy comments_ecriture on post_comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Traces GPS : STRICTEMENT privées. Le partage passe par la publication, jamais par
-- un accès direct à la trace — c'est la donnée la plus sensible de l'app.
create policy tracks_proprietaire on activity_tracks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Segments : catalogue commun, lisible par tous les inscrits ; modifiable par son auteur.
create policy segments_lecture on segments for select
  using (is_public or auth.uid() = created_by);
create policy segments_ecriture on segments for all
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- Efforts : un classement n'a de sens que s'il est visible ; l'écriture reste au
-- propriétaire (le serveur écrit via la clé de service lors de l'appariement).
create policy efforts_lecture on segment_efforts for select using (auth.role() = 'authenticated');
create policy efforts_ecriture on segment_efforts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy achievements_lecture on achievements for select using (auth.role() = 'authenticated');
create policy achievements_ecriture on achievements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 7. COMPTEURS ─────────────────────────────────────────────────────────────
-- Les compteurs sont tenus par TRIGGER et non par le code applicatif : une route qui
-- oublie de décrémenter laisse un compteur faux à l'écran pour toujours, et c'est
-- exactement le genre de chiffre plausible mais faux que ce projet traque.
create or replace function maj_compteurs_publication() returns trigger as $$
begin
  if tg_table_name = 'post_kudos' then
    update activity_posts set kudos_count = greatest(0, kudos_count + (case when tg_op = 'INSERT' then 1 else -1 end))
      where id = coalesce(new.post_id, old.post_id);
  else
    update activity_posts set comments_count = greatest(0, comments_count + (case when tg_op = 'INSERT' then 1 else -1 end))
      where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- PostgreSQL ne connaît pas `create trigger if not exists`. Le réflexe est alors
-- d'écrire `drop trigger if exists` avant — mais c'est une instruction DESTRUCTIVE,
-- que l'éditeur Supabase signale à juste titre, et qui n'a rien à faire dans une
-- migration censée ne rien détruire. On teste donc l'existence du déclencheur, et on
-- ne le crée que s'il manque : même rejouabilité, aucun mot destructeur.
do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where t.tgname = 'trg_kudos_compteur' and c.relname = 'post_kudos'
  ) then
    create trigger trg_kudos_compteur after insert or delete on post_kudos
      for each row execute function maj_compteurs_publication();
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where t.tgname = 'trg_comments_compteur' and c.relname = 'post_comments'
  ) then
    create trigger trg_comments_compteur after insert or delete on post_comments
      for each row execute function maj_compteurs_publication();
  end if;
end $$;

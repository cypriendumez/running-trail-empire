-- ─────────────────────────────────────────────────────────────────────────────
--  CLUBS ET DÉFIS
--
--  Deux briques communautaires qui se ressemblent mais ne servent pas la même
--  chose : un CLUB est un groupe durable (le club d'athlétisme, les collègues), un
--  DÉFI est une compétition bornée dans le temps (« 100 km en janvier »).
--
--  Aucun DROP, aucune instruction destructive : ce fichier est rejouable.
--  L'éditeur Supabase ne devrait afficher aucun avertissement.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. CLUBS ─────────────────────────────────────────────────────────────────
create table if not exists clubs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null check (length(trim(name)) between 2 and 60),
  description text,
  -- Le créateur peut disparaître (compte supprimé) sans emporter le club et ses
  -- membres : `set null` plutôt que `cascade`.
  created_by  uuid references profiles(id) on delete set null,
  avatar_url  text,
  city        text,
  -- 'public' : visible et rejoignable par tous. 'private' : sur invitation, donc
  -- invisible dans l'annuaire. Le défaut est PUBLIC ici, contrairement aux
  -- publications : un club sans membres ne sert à rien, et il ne porte aucune
  -- trace GPS.
  visibility  text not null default 'public' check (visibility in ('public', 'private')),
  member_count integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists clubs_visibilite_idx on clubs (visibility, member_count desc);

create table if not exists club_members (
  club_id   uuid not null references clubs(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists club_members_user_idx on club_members (user_id);

-- ── 2. DÉFIS ─────────────────────────────────────────────────────────────────
-- `metric` reste du texte contraint plutôt qu'un type énuméré : ajouter un critère
-- (dénivelé, régularité, sortie longue) ne doit pas exiger une migration de type,
-- opération autrement plus lourde qu'un simple CHECK à faire évoluer.
create table if not exists challenges (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null check (length(trim(name)) between 2 and 80),
  description text,
  created_by  uuid references profiles(id) on delete set null,
  -- Un défi peut être rattaché à un club, ou ouvert à tous.
  club_id     uuid references clubs(id) on delete cascade,
  metric      text not null check (metric in ('distance', 'elevation', 'sessions', 'longest_run')),
  -- Cible exprimée dans l'unité de la métrique : km, mètres de D+, ou nombre de séances.
  target      numeric(10,2) not null check (target > 0),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  -- Un défi qui finit avant de commencer n'a aucun sens, et produirait une barre de
  -- progression impossible à calculer.
  constraint challenges_dates_coherentes check (ends_on >= starts_on)
);
create index if not exists challenges_periode_idx on challenges (starts_on, ends_on);
create index if not exists challenges_club_idx on challenges (club_id);

create table if not exists challenge_participants (
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists challenge_participants_user_idx on challenge_participants (user_id);

-- ⚠️ AUCUNE COLONNE DE PROGRESSION ICI, ET C'EST DÉLIBÉRÉ.
-- La progression se recalcule à la lecture depuis les séances réelles, comme les
-- trophées. La stocker, ce serait risquer qu'elle survive à la correction ou à la
-- suppression d'une séance — un classement affichant une performance effacée.

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
alter table clubs                  enable row level security;
alter table club_members           enable row level security;
alter table challenges             enable row level security;
alter table challenge_participants enable row level security;

-- Clubs : les publics sont visibles de tous ; les privés seulement de leurs membres.
create policy clubs_lecture on clubs for select
  using (
    visibility = 'public'
    or exists (select 1 from club_members m where m.club_id = clubs.id and m.user_id = auth.uid())
  );
create policy clubs_creation on clubs for insert with check (auth.uid() = created_by);
-- Modification et suppression réservées au propriétaire ou aux administrateurs :
-- sans ce filtre, n'importe quel membre pourrait renommer ou effacer le club.
create policy clubs_gestion on clubs for update
  using (exists (select 1 from club_members m
                 where m.club_id = clubs.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')));
create policy clubs_suppression on clubs for delete
  using (exists (select 1 from club_members m
                 where m.club_id = clubs.id and m.user_id = auth.uid() and m.role = 'owner'));

create policy club_members_lecture on club_members for select using (auth.role() = 'authenticated');
-- On ne gère QUE sa propre adhésion : rejoindre, quitter. Inscrire quelqu'un d'autre
-- dans un club à son insu ne doit pas être possible.
create policy club_members_soi on club_members for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Défis : ceux d'un club privé ne sont visibles que de ses membres.
create policy challenges_lecture on challenges for select
  using (
    club_id is null
    or exists (select 1 from clubs c where c.id = challenges.club_id and c.visibility = 'public')
    or exists (select 1 from club_members m where m.club_id = challenges.club_id and m.user_id = auth.uid())
  );
create policy challenges_creation on challenges for insert with check (auth.uid() = created_by);
create policy challenges_gestion on challenges for update using (auth.uid() = created_by);
create policy challenges_suppression on challenges for delete using (auth.uid() = created_by);

create policy challenge_participants_lecture on challenge_participants for select using (auth.role() = 'authenticated');
create policy challenge_participants_soi on challenge_participants for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 4. COMPTEUR DE MEMBRES ───────────────────────────────────────────────────
-- Tenu par TRIGGER et non par le code applicatif : une route qui oublie de
-- décrémenter laisse un compteur faux à l'écran pour toujours. Même raisonnement
-- que pour les encouragements de la migration 019.
create or replace function maj_compteur_membres() returns trigger as $$
begin
  update clubs
     set member_count = greatest(0, member_count + (case when tg_op = 'INSERT' then 1 else -1 end))
   where id = coalesce(new.club_id, old.club_id);
  return null;
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where t.tgname = 'trg_membres_compteur' and c.relname = 'club_members'
  ) then
    create trigger trg_membres_compteur after insert or delete on club_members
      for each row execute function maj_compteur_membres();
  end if;
end $$;

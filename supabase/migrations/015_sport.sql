-- ============================================================
-- Pacevo — Séparer le SPORT du RÔLE de la séance
--
-- `workouts.type` mélangeait deux notions distinctes : le rôle dans l'entraînement
-- (easy / interval / long) et le sport (trail). La randonnée était donc rangée en
-- « trail », le vélo en « easy », la marche en « recovery » — et tout le monde
-- comptait comme de la course à pied.
--
-- Constaté en production le 7 août 2026 : 101,8 km comptabilisés sur 7 jours pour
-- 35,8 km réellement courus (le reste étant de la randonnée en montagne). Le plan
-- dimensionnait en conséquence une sortie longue de 33 km — pour un objectif 10 km,
-- chez un athlète dont la plus longue sortie des 28 derniers jours faisait 18 km.
--
-- Sur 12 mois de données : 205 Run, 57 Ride, 17 Hike, 4 Walk. Soit 27 % d'activités
-- non courues qui gonflaient le volume de course.
--
-- Le sport conditionne aussi l'estimation de VMA : sans lui, une sortie vélo à
-- 30 km/h passe le garde-fou de vitesse et produit une VMA de 40 km/h.
-- ============================================================

alter table workouts
  add column if not exists sport text;

comment on column workouts.sport is
  'Sport réel : run | bike | hike | walk | other. Distinct de `type`, qui décrit le rôle de la séance (easy, interval, long…). Seul `run` compte dans le volume de course et l''estimation de VMA.';

-- Les lignes existantes sont renseignées au prochain passage de synchronisation.
create index if not exists workouts_sport_idx on workouts (user_id, sport, date desc);

-- ============================================================
-- IDENTIFIANT D'ACTIVITÉ — la clé qui manquait
--
-- Aucun identifiant d'origine n'était conservé : une séance ne pouvait être
-- reconnue que par (date, titre). Deux sorties le même jour reçoivent pourtant le
-- même titre automatique de Garmin (« Le Touquet-Paris-Plage Course à pied »),
-- d'où 9 triplets en double sur 141 séances.
--
-- Pire, deux des trois chemins de synchronisation faisaient un upsert sur
-- ON CONFLICT (user_id, date, title) alors qu'AUCUNE contrainte de ce nom n'existe.
-- Postgres répondait 42P10 et le code, qui ne testait que `if (!error) synced++`,
-- comptait simplement zéro. Le webhook et le cron n'ont donc JAMAIS écrit une seule
-- séance ni déclenché le coach — la replanification « instantanée » n'a jamais eu lieu.
--
-- Index unique PARTIEL : les lignes historiques (external_id NULL) ne le violent pas,
-- et l'identité devient exacte au fil des synchronisations.
-- ============================================================

alter table workouts
  add column if not exists external_id text;

comment on column workouts.external_id is
  'Identifiant intervals.icu de l''activité. Seule clé fiable : (date, titre) collisionne quand l''athlète court deux fois le même jour.';

create unique index if not exists workouts_user_external_idx
  on workouts (user_id, external_id) where external_id is not null;

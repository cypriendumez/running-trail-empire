-- ============================================================
-- Pacevo — Disponibilités d'entraînement
--
-- Le plan remplissait 7 jours pour tout le monde, soit 5 à 6 jours de course.
-- Quelqu'un qui peut courir 3 fois par semaine recevait un plan inapplicable,
-- et la boucle d'adhérence ne le rattrapait qu'après trois échecs.
-- ============================================================

alter table profiles
  add column if not exists days_per_week  smallint,
  add column if not exists available_days smallint[] default '{}';

-- Nombre de séances de COURSE par semaine (le renforcement peut s'ajouter en plus).
alter table profiles drop constraint if exists profiles_days_per_week_check;
alter table profiles
  add constraint profiles_days_per_week_check
  check (days_per_week is null or (days_per_week >= 1 and days_per_week <= 14));

comment on column profiles.days_per_week is
  'Nombre de séances de course souhaitées par semaine (1-14). NULL = non renseigné, le coach déduit du niveau.';
comment on column profiles.available_days is
  'Jours de la semaine où l''athlète peut s''entraîner, au format JS (0 = dimanche … 6 = samedi). Tableau vide = tous les jours.';

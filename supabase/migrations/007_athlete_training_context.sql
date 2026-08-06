-- ============================================================
-- Pacevo — Contexte d'entraînement de l'athlète
-- Ancienneté en course à pied, terrain habituel, rapport au dénivelé.
-- Ces 3 champs nourrissent le coach IA (prescription des séances).
-- ============================================================

alter table profiles
  add column if not exists running_years  smallint,
  add column if not exists main_terrain   text,
  add column if not exists elevation_pref text;

-- Ancienneté : nombre d'années de pratique (0 = moins d'un an).
alter table profiles drop constraint if exists profiles_running_years_check;
alter table profiles
  add constraint profiles_running_years_check
  check (running_years is null or (running_years >= 0 and running_years <= 60));

-- Terrain habituel : détermine surface, allures pertinentes et charge mécanique.
alter table profiles drop constraint if exists profiles_main_terrain_check;
alter table profiles
  add constraint profiles_main_terrain_check
  check (main_terrain is null or main_terrain in ('plat','vallonne','montagne','plage','piste','mixte'));

-- Rapport au dénivelé : dose les séances de côtes et le D+ hebdomadaire.
alter table profiles drop constraint if exists profiles_elevation_pref_check;
alter table profiles
  add constraint profiles_elevation_pref_check
  check (elevation_pref is null or elevation_pref in ('evite','modere','aime','specialiste'));

comment on column profiles.running_years  is 'Années de pratique de la course à pied (0 = moins d''un an)';
comment on column profiles.main_terrain   is 'Terrain principal : plat | vallonne | montagne | plage | piste | mixte';
comment on column profiles.elevation_pref is 'Rapport au dénivelé : evite | modere | aime | specialiste';

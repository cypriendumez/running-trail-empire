-- ============================================================
-- Pacevo — Santé & antécédents de l'athlète
-- Pathologies déclarées, zones de blessure récurrentes, notes libres.
-- Ces données CONTRAIGNENT la prescription du coach IA : la santé prime
-- toujours sur la performance.
-- ============================================================

alter table profiles
  add column if not exists health_conditions text[] default '{}',
  add column if not exists injury_zones      text[] default '{}',
  add column if not exists health_notes      text;

comment on column profiles.health_conditions is
  'Pathologies déclarées (slugs) : asthme, diabete, hypertension, cardiaque, anemie, thyroide, allergies, apnee, migraines, digestif, covid_long, grossesse, surpoids';
comment on column profiles.injury_zones is
  'Zones de blessure récurrentes (slugs) : achille, genou, tibia, ischio, hanche, pied, dos, fracture_fatigue';
comment on column profiles.health_notes is
  'Notes santé libres de l''athlète (traitements, opérations, contre-indications) — lues par le coach IA';

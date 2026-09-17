-- ─────────────────────────────────────────────────────────────────────────────
--  029 — FC MAX / FC REPOS DÉCLARÉES, FACULTATIVES, SUR LE PROFIL
--
--  `performance_baselines` porte déjà max_hr et resting_hr, mais ses trois colonnes
--  utiles (vma_kmh, max_hr, resting_hr) sont NOT NULL depuis la 001 : impossible d'y
--  ranger une FC seule tant qu'aucune VMA n'est mesurée. Or la VMA ne se saisit plus à
--  l'inscription — elle vient du test 6 min que le coach prescrit en première séance.
--
--  Sans ces deux colonnes, l'athlète qui CONNAÎT sa FC max n'avait aucun endroit où la
--  mettre : le champ existait à l'inscription et sa valeur était jetée en silence.
--  Nullables, parce que le coach sait très bien s'en passer (il déduit alors la FC max
--  du maximum réellement enregistré en séance, et la FC repos de la montre).
--
--  Ordre de lecture côté coach (lib/ai/coachContext) :
--    FC max   : baseline (mesurée) ▸ profil déclaré ▸ max RÉELLEMENT observé en séance
--               ▸ seuil Garmin ÷ 0,92 ▸ 220 − âge
--               ⚠️ et jamais SOUS le maximum observé : on ne peut pas avoir une FC max
--               inférieure à un battement réellement atteint.
--    FC repos : baseline ▸ profil déclaré ▸ garmin_metrics.restingHR (Garmin/Coros)
--
--  RLS : `profiles` a déjà sa politique (chacun son profil) — ajouter des colonnes ne
--  demande aucune politique nouvelle, l'écriture depuis le navigateur reste autorisée.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists max_hr     smallint check (max_hr > 100 and max_hr < 250);
alter table profiles add column if not exists resting_hr smallint check (resting_hr > 25 and resting_hr < 120);

comment on column profiles.max_hr     is 'FC max déclarée par l''athlète (facultative). Le coach retient toujours la plus haute entre celle-ci et le maximum réellement enregistré en séance.';
comment on column profiles.resting_hr is 'FC de repos déclarée par l''athlète (facultative). À défaut, le coach lit garmin_metrics.restingHR.';

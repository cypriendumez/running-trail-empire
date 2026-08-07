-- ============================================================
-- Pacevo — Métriques de séance réellement disponibles
--
-- Recensement du 7 août 2026 : sur 60 séances en base, cardiac_decoupling,
-- training_effect, ground_contact_ms, vertical_oscillation_cm, avg_power_watts et
-- weather_temp_c étaient remplis à 0 %. Le coach prétendait donc analyser des
-- données qu'il n'avait pas.
--
-- Vérification côté intervals.icu : une partie est bien absente (la montre ne les
-- mesure pas), mais quatre champs TRÈS utiles étaient disponibles à 8/8 sans jamais
-- être enregistrés — dont la température (31,5 °C sur les sorties récentes !) et le
-- temps passé dans chaque zone de fréquence cardiaque.
-- ============================================================

alter table workouts
  add column if not exists gap_min_km       numeric(5,2),
  add column if not exists hr_zone_seconds  integer[],
  add column if not exists intensity_pct    smallint;

comment on column workouts.gap_min_km is
  'Allure ajustée au dénivelé (Grade Adjusted Pace), en min/km. Seule allure comparable entre plat et montagne.';
comment on column workouts.hr_zone_seconds is
  'Secondes passées dans chaque zone FC (index 0 = Z1). Permet de mesurer le 80/20 en TEMPS et non en nombre de séances.';
comment on column workouts.intensity_pct is
  'Intensité de la séance en % (icu_intensity) : rapport de l''effort au seuil.';

-- weather_temp_c existe déjà mais n'était jamais alimentée : c'est le code de
-- synchronisation qui est corrigé, pas le schéma.

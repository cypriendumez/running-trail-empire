-- ============================================================
-- Pacevo — Économie de course et récupération cardiaque
--
-- Deux métriques présentes dans l'API intervals.icu, jamais exploitées, et qui
-- valent mieux que ce dont le coach disposait :
--
-- 1. RATIO VERTICAL (average_vertical_ratio) — oscillation verticale rapportée à la
--    longueur de foulée, en %. C'est LE marqueur d'économie de course : il dit quelle
--    part du travail part vers le haut au lieu d'aller vers l'avant. Plus fiable que
--    l'oscillation seule, qui dépend de la taille du coureur. Repères : < 6,5 % très
--    économique, 6,5-8 % bon, > 9 % perfectible.
--
-- 2. RÉCUPÉRATION CARDIAQUE (icu_hrr) — chute de FC dans les 60 s suivant un effort
--    dur, en bpm. Marqueur reconnu du statut parasympathique : une chute qui se réduit
--    d'une semaine à l'autre annonce la fatigue avant que la VFC ne bouge, et une chute
--    qui s'accroît signe une forme qui monte. Mesurée seulement sur les séances dures.
--
-- Aucune ne coûte d'appel réseau supplémentaire : elles arrivent déjà dans la réponse
-- de la liste d'activités, on ne les lisait pas.
-- ============================================================

alter table workouts
  add column if not exists vertical_ratio_pct  numeric(4,2),
  add column if not exists hrr_bpm             smallint;

comment on column workouts.vertical_ratio_pct is
  'Ratio vertical (%) = oscillation verticale / longueur de foulée. Économie de course : plus bas = mieux.';
comment on column workouts.hrr_bpm is
  'Récupération cardiaque : chute de FC en bpm sur les 60 s après un effort dur. Plus haut = mieux récupéré.';

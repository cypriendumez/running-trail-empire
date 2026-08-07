-- ============================================================
-- Pacevo — Performance mesurée (et non plus estimée)
--
-- Deux gisements exploitables chez intervals.icu, jamais utilisés jusqu'ici :
--
-- 1. COURBE D'ALLURE (/athlete/{id}/pace-curves) — meilleurs efforts par distance
--    sur 42 jours, PLUS un modèle de vitesse critique ajusté sur les données réelles
--    (r² = 0,9999 sur le profil de test). C'est un seuil MESURÉ, là où le coach
--    travaillait jusqu'ici sur un pourcentage de VMA estimée.
--
-- 2. INTERVALLES RÉALISÉS (/activity/{id}/intervals) — allure, GAP, FC et zone de
--    chaque répétition. Permet enfin de comparer le PRESCRIT au RÉALISÉ : a-t-il tenu
--    l'allure demandée, ou décroché sur les dernières répétitions ?
--
-- Les deux sont stockés en JSON pour éviter un appel d'API à chaque lecture du
-- contexte (le coach le construit plusieurs fois par jour).
-- ============================================================

alter table profiles
  add column if not exists pace_curve         jsonb,
  add column if not exists last_quality_exec  jsonb;

comment on column profiles.pace_curve is
  'Meilleurs efforts par distance sur 42 j + vitesse critique (m/s) et D''. Rafraîchi une fois par jour.';
comment on column profiles.last_quality_exec is
  'Exécution de la dernière séance de qualité : allure cible, allures réalisées, décrochage éventuel.';

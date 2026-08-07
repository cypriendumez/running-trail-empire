-- ============================================================
-- Pacevo — Localisation d'entraînement
--
-- La température de la montre est mesurée AU POIGNET : elle mélange air ambiant et
-- chaleur corporelle. Constaté sur données réelles le 7 août 2026 — une sortie de
-- 18h30 rapportée plus chaude qu'une randonnée de 11h33 le même jour, et jusqu'à
-- 3 °C d'écart avec le relevé réel au même endroit à la même heure.
--
-- On stocke donc le point de départ GPS de la dernière séance pour interroger la
-- météo réelle (Open-Meteo : gratuit, sans clé) — passé ET prévisions à 7 jours,
-- ce qui permet d'anticiper une canicule au lieu de la constater après coup.
-- ============================================================

alter table profiles
  add column if not exists last_lat      numeric(9,5),
  add column if not exists last_lon      numeric(9,5),
  add column if not exists last_loc_at   timestamptz;

comment on column profiles.last_lat is 'Latitude du départ de la dernière séance GPS — sert à la météo réelle.';
comment on column profiles.last_lon is 'Longitude du départ de la dernière séance GPS.';
comment on column profiles.last_loc_at is 'Date de ce relevé de position (permet de le rafraîchir quand l''athlète déménage ou part en stage).';

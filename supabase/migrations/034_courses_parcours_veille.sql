-- ─────────────────────────────────────────────────────────────────────────────
--  034 — COURSES : le lien du PARCOURS, et la date de la dernière VEILLE
--
--  Demandé par Cyprien le 01/10/2026 : « ajoute les liens des parcours, et des sortes de
--  bots qui mettent instantanément les liens, les dates et les résultats quand ça sort ».
--
--  · `parcours_url` : le tracé publié par l'organisateur (fichier .gpx, Openrunner, Trace
--    de Trail, page « Parcours »…), lu sur sa page officielle (lib/races/parcoursSite).
--  · `veille_at` : quand la page officielle a été relue pour la dernière fois. Elle évite
--    de relire la même page à chaque ouverture de la fiche (veille « à la consultation »,
--    au plus toutes les 6 heures) et dit au panneau d'administration ce qui a été vu.
--
--  Facultatives : sans elles, l'application et les scripts fonctionnent comme avant.
--  ⚠️ PAS DE DROP, pas même « if exists ». Rejouer ce fichier ne fait rien.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.races add column if not exists parcours_url text;
alter table public.races add column if not exists veille_at timestamptz;

comment on column public.races.parcours_url is 'Tracé de la course publié par l''organisateur (gpx, service de tracés ou page Parcours), lu sur la page officielle.';
comment on column public.races.veille_at is 'Dernière relecture de la page officielle par la veille (quotidienne, hebdomadaire ou à la consultation).';

-- 035 — VOLUME CIBLE DÉCLARÉ À L'INSCRIPTION (11/10/2026)
--
-- Le curseur « Volume cible / semaine » de l'étape Objectifs n'était enregistré NULLE PART :
-- la colonne n'existait pas, la réponse était jetée. Le plan s'en sert désormais comme d'un
-- plafond de PROGRESSION (voir src/lib/coach/volumeCible.ts) : il cesse de monter au-delà,
-- sans jamais couper sous ce que l'athlète court déjà. NULL = pas de cible (curseur non touché).
--
-- ⚠️ À LANCER À LA MAIN dans l'éditeur SQL de Supabase. Tant qu'elle n'est pas passée,
-- l'inscription continue normalement : l'écriture du volume est isolée et non bloquante.

alter table public.profiles add column if not exists target_weekly_km integer;

alter table public.profiles drop constraint if exists profiles_target_weekly_km_check;
alter table public.profiles add constraint profiles_target_weekly_km_check
  check (target_weekly_km is null or target_weekly_km between 5 and 300);

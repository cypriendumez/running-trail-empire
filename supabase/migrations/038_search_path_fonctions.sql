-- ─────────────────────────────────────────────────────────────────────────────
--  038 — B5 de l'audit : figer le search_path de trois fonctions trigger.
--
--  Advisors Supabase (niveau WARN, « Function Search Path Mutable »).
--  `maj_compteurs_publication` et `maj_compteur_membres` sont SECURITY DEFINER :
--  sans search_path figé, un appelant pourrait poser une table homonyme dans un
--  schéma qu'il contrôle et la faire préférer à la vraie. `update_shoe_km` n'est
--  pas « definer », mais la bonne pratique (et l'advisor) demande le même verrou.
--
--  ALTER (et non `create or replace`) : on NE touche PAS le corps ni la logique.
--  ⚠️ Si une migration future recrée l'une de ces fonctions avec
--  `create or replace function`, elle DOIT y remettre `set search_path = public`,
--  sinon le verrou saute en silence.
--
--  Aucune instruction « drop » (invariant du projet : migrations ≥ 007 sans DROP).
-- ─────────────────────────────────────────────────────────────────────────────

alter function public.update_shoe_km()            set search_path = public;
alter function public.maj_compteurs_publication()  set search_path = public;
alter function public.maj_compteur_membres()       set search_path = public;

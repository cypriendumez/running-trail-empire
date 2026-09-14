-- ─────────────────────────────────────────────────────────────────────────────
--  LA POLITIQUE QUI MANQUAIT SUR performance_baselines
--
--  La 001 activait la RLS sur cette table (ligne 355) mais n'écrivait AUCUNE politique :
--  seule la clé de service pouvait donc y écrire. Or la dernière étape de l'inscription
--  insère la VMA saisie depuis le NAVIGATEUR, avec la session de l'athlète.
--
--  Mesuré le 14/09/2026 avec une session réelle :
--    INSERT performance_baselines → 42501 new row violates row-level security policy
--
--  Conséquence, pour 100 % des inscrits (la VMA est obligatoire à l'étape précédente) :
--  « Erreur lors de la sauvegarde » sur le bouton Terminer, aucun plan généré avant le
--  cron de la nuit, et la VMA déclarée perdue. La table était vide depuis juin.
-- ─────────────────────────────────────────────────────────────────────────────
create policy "baselines_all_own" on performance_baselines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

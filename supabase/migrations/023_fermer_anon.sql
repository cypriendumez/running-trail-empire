-- ─────────────────────────────────────────────────────────────────────────────
--  023 — FERMER LA VITRINE AUX VISITEURS NON CONNECTÉS.
--
--  DÉFAUT TROUVÉ EN VÉRIFIANT LA MIGRATION 022, pas en la relisant. Testée avec la
--  clé publique de l'application :
--      GET /rest/v1/athletes_publics        → 200, une ligne visible
--      POST /rest/v1/rpc/compte_est_prive   → 200, « false »
--  Autrement dit : n'importe qui, sans compte, pouvait lister le nom, l'avatar, la
--  ligue et le score de TOUS les athlètes, et demander si un compte est privé.
--
--  POURQUOI LE `revoke ... from public` DE LA 022 N'A RIEN FAIT. Supabase accorde
--  d'office les droits au rôle `anon` sur tout nouvel objet du schéma `public`
--  (`alter default privileges ... grant all on tables to anon, authenticated`).
--  Or `public` — le pseudo-rôle « tout le monde » — n'est PAS `anon` : révoquer à
--  `public` laisse intacte la concession explicite faite à `anon`. Il faut la
--  révoquer nommément.
--
--  ⚠️ LA LEÇON, VALABLE POUR TOUTE VUE FUTURE : une VUE N'A PAS DE RLS. Sur une
--  table, la RLS rattrapait un `grant` trop large — c'est pour cela que `profiles`
--  ne fuyait pas malgré les droits d'`anon`. Sur une vue, le `grant` est la SEULE
--  barrière. Une vue de commodité mal fermée expose donc tout ce qu'elle sait.
-- ─────────────────────────────────────────────────────────────────────────────

-- La vitrine des athlètes : réservée aux inscrits. Aucun écran de l'application ne
-- la lit sans authentification — /api/social/follow exige déjà une session.
revoke all on public.athletes_publics from anon;

-- Le drapeau « compte privé » : même traitement. Savoir qui a verrouillé son compte
-- est déjà une information sur les gens.
revoke all on function public.compte_est_prive(uuid) from anon;

-- On reconfirme la concession utile, pour que ce fichier se suffise à lui-même si on
-- le rejoue sur une base neuve.
grant select on public.athletes_publics to authenticated;
grant execute on function public.compte_est_prive(uuid) to authenticated;

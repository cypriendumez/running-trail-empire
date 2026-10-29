-- ─────────────────────────────────────────────────────────────────────────────
--  040 — Alerte de sécurité Supabase du 27/10/2026 : « Table publicly accessible ».
--
--  La table visée est `spatial_ref_sys`, le catalogue des systèmes de coordonnées
--  que PostGIS installe dans le schéma `public`. Aucune donnée d'utilisateur, mais
--  `anon` et `authenticated` y avaient TOUS les droits (DELETE, UPDATE, TRUNCATE…) :
--  n'importe qui muni de la clé publique du site pouvait la vider et casser PostGIS.
--  Elle appartient à `supabase_admin` : `postgres` ne peut ni y activer la RLS ni
--  retirer ces droits (« must be owner »).
--
--  POSTGIS N'EST PAS UTILISÉ (vérifié le 29/10/2026) : `races.location` et
--  `trail_routes.start_location` sont vides (0 ligne remplie), aucun code ne les lit
--  ni ne les écrit, aucune fonction ST_* n'est appelée. Supabase recommande alors de
--  retirer l'extension (base de connaissances : « Security Advisor flags
--  spatial_ref_sys and other PostGIS objects in the public schema »). Le retrait
--  emporte les deux colonnes vides et l'index `races_location_idx`, rien d'autre.
--
--  ⚠️ SEULE INSTRUCTION DESTRUCTIVE TOLÉRÉE depuis la 007 (tests/coach.test.ts) : il
--  n'existe aucune autre façon de fermer cette table depuis le rôle `postgres`.
-- ─────────────────────────────────────────────────────────────────────────────

drop extension if exists postgis cascade;

-- La fonction du déclencheur de la 039 n'a pas à être appelable par /rest/v1/rpc
-- (avertissement « Public Can Execute SECURITY DEFINER Function »). Les rôles qui
-- suppriment des courses (`postgres`, `service_role`) gardent leur droit explicite.
revoke execute on function public.races_noter_jumelle() from public, anon, authenticated;

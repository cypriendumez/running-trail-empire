-- 041 — DOUBLE AUTHENTIFICATION : la BASE exige le code des comptes qui l'ont activée (08/11/2026)
--
-- ⚠️ À EXÉCUTER À LA MAIN dans l'éditeur SQL de Supabase (il n'existe aucune RPC exec_sql),
-- AVANT de déployer le code de la double authentification : dès le déploiement, un coureur peut
-- l'activer, et sans ces politiques sa base resterait lisible en `aal1`. Sans facteur en base
-- (0 au 08/11/2026), ces politiques ne changent RIEN pour personne : les exécuter d'abord est sans risque.
--
-- POURQUOI. L'application traite une session `aal1` d'un compte protégé comme déconnectée
-- (`src/lib/supabase/server.ts`). Mais le navigateur peut interroger la base DIRECTEMENT
-- (PostgREST, avec la clé publique et le jeton de session) : sans ces politiques, un mot de passe
-- volé suffirait à lire les données de santé d'un coureur par l'API de Supabase, en contournant
-- l'application et son second facteur.
--
-- COMMENT. Une politique RESTRICTIVE (elle s'ajoute en ET à toutes les autres) sur chaque table
-- protégée par RLS du schéma public (49 au 08/11/2026) : un compte qui a un facteur TOTP vérifié
-- doit présenter un jeton `aal2`. Un compte sans double authentification n'est pas concerné.
-- Modèle : doc Supabase « Multi-Factor Authentication — Enforce rules for MFA logins ».
--
-- ⚠️ LE RÔLE SERVICE (clé d'administration, crons, routes serveur) N'EST PAS CONCERNÉ : il
-- contourne la RLS. Les routes de l'application, elles, passent par `getUser()`, déjà filtré.
--
-- ⚠️ UNE TABLE CRÉÉE PLUS TARD N'AURA PAS CETTE POLITIQUE : relancer le bloc « do $$ » ci-dessous
-- après chaque nouvelle table. Il est relançable SANS aucun DROP (règle du projet : l'éditeur SQL
-- de Supabase signale tout DROP comme destructif, `tests/coach.test.ts`) : il ne crée la politique
-- que là où elle manque.

-- 1. La règle, évaluée une fois par requête grâce au `(select …)` des politiques.
create or replace function public.exigence_mfa_respectee()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.exigence_mfa_respectee() from public, anon;
grant execute on function public.exigence_mfa_respectee() to authenticated;

-- 2. Chaque table du schéma public sous RLS.
--    Relançable : une table qui a déjà la politique est laissée telle quelle.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname and p.policyname = 'exiger_aal2_si_mfa'
      )
  loop
    execute format(
      'create policy exiger_aal2_si_mfa on public.%I as restrictive for all to authenticated '
      'using ((select public.exigence_mfa_respectee())) with check ((select public.exigence_mfa_respectee()))',
      t.relname);
  end loop;
end $$;

-- ⚠️ LES FICHIERS (storage.objects) NE SONT PAS TOUCHÉS, ET C'EST VOULU. Relevé le 08/11/2026 :
-- la table n'a AUCUNE politique — aucun jeton de coureur n'y accède directement ; avatars et pièces
-- jointes passent par les routes serveur (`getUser()` filtré). Et elle appartient à
-- `supabase_storage_admin` : y créer une politique depuis l'éditeur pourrait échouer et annuler tout
-- ce bloc. Le jour où une politique y donne un accès direct, lui adjoindre la même restriction.

-- 3. Contrôle : doit renvoyer autant de lignes que de tables sous RLS (49 au 08/11/2026).
-- select schemaname, tablename from pg_policies where policyname = 'exiger_aal2_si_mfa' order by 1, 2;

-- RETOUR ARRIÈRE (si besoin) :
-- do $$ declare t record; begin
--   for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'exiger_aal2_si_mfa' loop
--     execute format('drop policy exiger_aal2_si_mfa on public.%I', t.tablename);
--   end loop; end $$;
-- drop function if exists public.exigence_mfa_respectee();

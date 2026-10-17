-- 036 — COLONNES PROTÉGÉES DE `profiles` : PLUS D'AUTO-SURCLASSEMENT (constat d'audit C1, 15/10/2026)
--
-- ⚠️ FAILLE RÉELLE, mesurée sur la base de production. `authenticated` a un droit `UPDATE`
-- AU NIVEAU DE LA TABLE `profiles`, et la politique `profiles_update_own` laisse chacun
-- écrire sa propre ligne. Résultat : un compte connecté pouvait, par un simple PATCH REST,
-- poser `subscription_tier = 'premium'` sur SA ligne et débloquer les fonctions payantes
-- SANS payer. Idem pour `created_at` (fausse l'essai) et le classement (`league`,
-- `xp_points`, `discipline_score`).
--
-- ⚠️ POURQUOI UN DÉCLENCHEUR, ET PAS UN `revoke`. Un `revoke update (colonnes)` NE FAIT RIEN
-- tant qu'un droit `UPDATE` existe sur TOUTE la table (mesuré : le revoke renvoie « Success »
-- sans effet). Le corriger par les droits imposerait de révoquer l'UPDATE de table puis de
-- ré-accorder, une par une, les ~30 colonnes qu'un athlète modifie légitimement — en oublier
-- une casse l'inscription (PostgREST rejette tout l'update si une colonne manque). Le
-- déclencheur, lui, ne vise QUE les 6 colonnes sensibles et laisse tout le reste intact.
--
-- ⚠️ LE SERVICE ROLE N'EST PAS CONCERNÉ. Le webhook Stripe et les crons écrivent
-- `subscription_tier` avec la clé de service ; on ne bride que les rôles `authenticated` et
-- `anon` (les requêtes venues du navigateur via l'API). L'éditeur SQL (rôle `postgres`) non
-- plus : une valeur de rôle inattendue n'est jamais bridée, pour ne jamais bloquer le webhook.
--
-- ⚠️ `is distinct from` : réécrire une colonne protégée avec SA PROPRE valeur reste permis
-- (un update qui ne la change pas ne déclenche rien) ; seul un vrai changement est refusé.
--
-- ⚠️ À LANCER À LA MAIN dans l'éditeur SQL de Supabase. APPLIQUÉE EN PRODUCTION LE 15/10/2026
-- (déclencheur `trg_profiles_colonnes_protegees` vérifié présent et actif). Ce fichier est la
-- copie canonique ; `tests/securite-profil.test.ts` échoue s'il cesse de couvrir les 6 colonnes.

create or replace function public.profiles_bloque_colonnes_sensibles()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'
  );
begin
  -- On ne bride QUE les requêtes d'un compte connecté (ou anonyme) venues de l'API.
  -- Clé de service (webhook Stripe, crons) et éditeur SQL : v_role hors de cette liste → libre.
  if v_role in ('authenticated', 'anon') then
    if new.subscription_tier      is distinct from old.subscription_tier
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.created_at             is distinct from old.created_at
    or new.league                 is distinct from old.league
    or new.xp_points              is distinct from old.xp_points
    or new.discipline_score       is distinct from old.discipline_score then
      raise exception 'profiles : colonnes protégées (abonnement, classement) non modifiables';
    end if;
  end if;
  return new;
end;
$$;

-- Idempotent SANS `drop` (les migrations ≥ 007 n'en contiennent aucune, cf. tests/coach.test.ts) :
-- la FONCTION se (re)pose en `or replace`, et le DÉCLENCHEUR n'est créé que s'il manque.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_profiles_colonnes_protegees'
      and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger trg_profiles_colonnes_protegees
      before update on public.profiles
      for each row execute function public.profiles_bloque_colonnes_sensibles();
  end if;
end $$;

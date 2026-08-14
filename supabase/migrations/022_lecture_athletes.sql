-- ─────────────────────────────────────────────────────────────────────────────
--  022 — LIRE LE PROFIL DES AUTRES SANS OUVRIR LA TABLE `profiles`.
--
--  DEUX DÉFAUTS, MIS AU JOUR PAR LA MIGRATION 021.
--
--  1. CELUI QUE 021 A INTRODUIT. Sa politique `comments_ecriture` fait
--     `join profiles auteur on auteur.id = p.user_id` pour lire `is_private`. Or une
--     sous-requête dans une politique RLS est ELLE-MÊME soumise à la RLS de la table
--     jointe, et `profiles` n'expose que `profiles_select_own` (auth.uid() = id).
--     La jointure ne renvoie donc RIEN dès qu'il s'agit du profil d'un autre :
--     la condition devient fausse et TOUT commentaire sur la publication d'autrui est
--     refusé — y compris sur un compte public. Invisible aujourd'hui : un seul
--     inscrit, aucune publication en base.
--
--  2. UN DÉFAUT PLUS ANCIEN, du même tonneau. L'écran « suivre des athlètes »
--     (/api/social/follow) lit `profiles` avec le client de l'utilisateur. Avec
--     `profiles_select_own`, il ne remonte que SA PROPRE ligne — que `suggestable`
--     écarte ensuite. La liste d'athlètes est donc VIDE pour tout le monde, et la
--     recherche ne trouve jamais personne. Là encore, indétectable à un seul inscrit.
--
--  ⚠️ CE QU'IL NE FAUT SURTOUT PAS FAIRE POUR CORRIGER : ajouter une politique
--  « les inscrits peuvent lire les profils ». La RLS travaille par LIGNE, pas par
--  colonne : rendre la ligne lisible exposerait `intervals_api_key`, `email` et les
--  identifiants Stripe à n'importe quel inscrit via PostgREST. On remplacerait un
--  défaut d'ergonomie par une fuite de secrets.
--
--  On expose donc EXACTEMENT ce qui est public, et rien d'autre.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. LE STRICT NÉCESSAIRE POUR UNE POLITIQUE ───────────────────────────────
-- Une fonction qui ne rend qu'un booléen. `security definer` lui permet de lire
-- `profiles` malgré la RLS ; `search_path` figé empêche qu'on lui substitue une
-- table `profiles` piégée depuis un autre schéma.
create or replace function public.compte_est_prive(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_private, false) from profiles where id = p_id;
$$;

comment on function public.compte_est_prive(uuid) is
  'Le compte est-il privé ? Seul booléen exposé : la table profiles reste fermée.';

-- Personne par défaut, les inscrits ensuite : une fonction `security definer`
-- accessible à `public` serait ouverte aux visiteurs non authentifiés.
revoke all on function public.compte_est_prive(uuid) from public;
grant execute on function public.compte_est_prive(uuid) to authenticated;

-- ── 2. LA POLITIQUE, SANS JOINTURE SUR `profiles` ────────────────────────────
-- Même règle qu'en 021, mais la lecture du drapeau passe par la fonction.
alter policy comments_ecriture on post_comments
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from activity_posts p
      where p.id = post_comments.post_id
        and (
          -- Chez soi, toujours.
          p.user_id = auth.uid()
          -- Compte public : quiconque VOIT la publication peut la commenter.
          or (public.compte_est_prive(p.user_id) = false and (
                p.visibility = 'public'
                or (p.visibility = 'followers' and exists (
                      select 1 from follows f
                      where f.following_id = p.user_id
                        and f.follower_id = auth.uid()
                        and f.status = 'accepted'))))
          -- Compte privé : amis seulement, c'est-à-dire suivi dans les DEUX sens.
          or (public.compte_est_prive(p.user_id) = true
              and p.visibility <> 'private'
              and exists (
                    select 1 from follows f1
                    where f1.follower_id = auth.uid()
                      and f1.following_id = p.user_id
                      and f1.status = 'accepted')
              and exists (
                    select 1 from follows f2
                    where f2.follower_id = p.user_id
                      and f2.following_id = auth.uid()
                      and f2.status = 'accepted'))
        )
    )
  );

-- ── 3. LA VITRINE PUBLIQUE DES ATHLÈTES ──────────────────────────────────────
-- Les colonnes sont ÉNUMÉRÉES à la main, jamais `select *`. Une colonne sensible
-- ajoutée demain à `profiles` ne peut pas se retrouver exposée par simple oubli :
-- il faudrait l'ajouter ici volontairement. Même principe que `ATHLETE_COLS` côté
-- application, mais appliqué là où il compte vraiment — en base.
create or replace view public.athletes_publics as
  select id, full_name, avatar_url, league, discipline_score,
         is_private, onboarding_completed
  from profiles;

comment on view public.athletes_publics is
  'Colonnes PUBLIQUES d''un athlète. profiles reste fermée (clé intervals.icu, e-mail, Stripe).';

-- La vue s'exécute avec les droits de son propriétaire (comportement par défaut) :
-- elle traverse donc la RLS de `profiles`, ce qui est tout son objet. Seuls les
-- inscrits peuvent la lire.
revoke all on public.athletes_publics from public;
grant select on public.athletes_publics to authenticated;

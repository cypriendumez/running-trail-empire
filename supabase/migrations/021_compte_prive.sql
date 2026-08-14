-- ─────────────────────────────────────────────────────────────────────────────
--  021 — COMPTE PUBLIC / COMPTE PRIVÉ, et qui a le droit de COMMENTER.
--
--  Voir et commenter étaient le même droit : tout inscrit pouvait commenter toute
--  publication qu'il voyait. Sur un compte public c'est voulu — un inconnu peut
--  féliciter une performance, comme sur Strava. Sur un compte privé, non.
--
--  L'AMITIÉ EST UN SUIVI DANS LES DEUX SENS. C'est la définition posée par la
--  migration 019 ; on ne crée pas ici une seconde notion d'ami concurrente. Aucune
--  file de demandes à traiter : suivre en retour suffit.
--
--  ⚠️ POURQUOI CETTE RÈGLE DOIT VIVRE EN BASE ET PAS SEULEMENT DANS LA ROUTE.
--  La clé publique (anon) permet d'écrire directement dans PostgREST. Une règle
--  appliquée uniquement dans /api/social/interact se contournerait avec un simple
--  curl : il suffirait d'insérer la ligne dans `post_comments` sans passer par
--  l'application. C'est la politique RLS ci-dessous qui protège réellement.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. LE DRAPEAU ────────────────────────────────────────────────────────────
-- Défaut FAUX (compte public) : c'est le comportement actuel de l'application, et
-- basculer tout le monde en privé sans prévenir romprait des fils de commentaires
-- déjà ouverts. Le réglage est offert dans Profil → Confidentialité.
alter table profiles add column if not exists is_private boolean not null default false;

comment on column profiles.is_private is
  'Compte privé : seuls les amis (suivi réciproque accepté) peuvent commenter les publications.';

-- ── 2. LA RÈGLE, EN BASE ─────────────────────────────────────────────────────
-- L'ancienne politique autorisait toute écriture sous son propre nom, sans regarder
-- la publication visée. On la remplace par la même règle que la route, exprimée en
-- SQL. Elle reste volontairement PERMISSIVE en cas d'absence de relation sur un
-- compte public : c'est tout l'intérêt d'un compte public.
drop policy if exists comments_ecriture on post_comments;

create policy comments_ecriture on post_comments
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from activity_posts p
      join profiles auteur on auteur.id = p.user_id
      where p.id = post_comments.post_id
        and (
          -- Chez soi, toujours.
          p.user_id = auth.uid()
          -- Compte public : quiconque VOIT la publication peut la commenter. La
          -- visibilité de la publication reste décidée par `posts_lecture`.
          or (auteur.is_private = false and (
                p.visibility = 'public'
                or (p.visibility = 'followers' and exists (
                      select 1 from follows f
                      where f.following_id = p.user_id
                        and f.follower_id = auth.uid()
                        and f.status = 'accepted'))))
          -- Compte privé : amis seulement, c'est-à-dire suivi dans les DEUX sens.
          or (auteur.is_private = true
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

-- ── 3. LECTURE DU DRAPEAU ────────────────────────────────────────────────────
-- `is_private` doit être lisible par les autres inscrits : l'application doit
-- pouvoir masquer le champ de commentaire AVANT que l'athlète écrive son message.
-- Lui laisser taper un commentaire pour le refuser ensuite serait une brimade.
-- (Aucune politique à créer si `profiles` expose déjà ses colonnes publiques en
--  lecture aux inscrits ; à vérifier après passage de cette migration.)

-- 042 — ABONNEMENT DE CALENDRIER (27/11/2026)
--
-- Le coureur abonne son Apple Calendrier, Google Agenda ou Outlook à une adresse secrète
-- (`/api/calendrier/flux/<jeton>.ics`) : ses séances y apparaissent à midi, et suivent les
-- replanifications du coach. Voir src/lib/calendrier/.
--
-- ⚠️ ON NE GARDE QUE L'EMPREINTE DU JETON (SHA-256), jamais le jeton. L'adresse vaut une clé :
-- qui la possède lit le plan. Une fuite de cette table ne donne donc aucune adresse valable.
-- Contrepartie assumée : l'adresse ne se montre qu'une fois, à la création ; perdue, on en
-- crée une nouvelle (ce qui coupe l'ancienne).
--
-- Un seul abonnement par coureur (clé primaire `user_id`) : recréer le lien REMPLACE l'ancien,
-- et révoquer, c'est supprimer la ligne.
--
-- `user_id` cascade depuis `profiles(id)` : la suppression du compte emporte l'abonnement,
-- comme `notifications` (route /api/account/delete).
--
-- RLS activée SANS politique : la table n'est lue et écrite que par le serveur (service role,
-- routes /api/calendrier/*). Aucun accès direct depuis le navigateur, l'empreinte comprise.
--
-- ⚠️ À LANCER À LA MAIN dans l'éditeur SQL de Supabase. Pas de RPC `exec_sql` sur ce projet.
-- Tant qu'elle n'est pas passée, l'encart des réglages dit « Bientôt disponible », aucun lien ne
-- peut être créé, et le flux répond 404 (sans alerte) : rien d'autre ne casse.

create table if not exists public.calendrier_abonnements (
  user_id          uuid        primary key references public.profiles(id) on delete cascade,
  jeton_empreinte  text        not null unique,
  cree_le          timestamptz not null default now(),
  derniere_lecture timestamptz
);

alter table public.calendrier_abonnements enable row level security;

-- Pas de politique : ni anon ni authenticated ne lisent cette table.
revoke all on public.calendrier_abonnements from anon, authenticated;

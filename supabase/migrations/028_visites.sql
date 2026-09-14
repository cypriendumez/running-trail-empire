-- ─────────────────────────────────────────────────────────────────────────────
--  MESURE D'AUDIENCE MAISON — sans cookie, sans identifiant permanent, sans tiers.
--
--  Pourquoi pas Vercel Web Analytics : sur le palier Hobby, 1 mois d'historique et
--  aucune API — rien ne pourrait s'afficher dans l'espace coach.
--
--  Ce qui est stocké, et ce qui ne l'est PAS :
--   · `visiteur`  = sha256(sel + jour + adresse IP + navigateur), tronqué. Le sel est
--                   secret et le jour entre dans le calcul : l'empreinte CHANGE chaque
--                   jour, on ne peut donc pas suivre une personne d'un jour à l'autre, et
--                   l'adresse IP n'est jamais écrite. C'est le modèle de l'exemption CNIL
--                   pour la mesure d'audience (pas de consentement requis).
--   · `pays`      = code à deux lettres fourni par l'hébergeur, pas une position.
--   · `referent`  = HÔTE de la page d'origine seulement (jamais l'adresse complète).
--   · `compte`    = sha256(sel + identifiant du compte), tronqué, pour les visites
--                   CONNECTÉES seulement : un pseudonyme STABLE (pas de jour), sans quoi
--                   « combien de clients utilisent l'application cette semaine » n'a pas
--                   de réponse. Il ne remonte pas au compte sans le sel.
--
--  Purge : les lignes de plus de 13 mois sont retirées par le cron d'entretien.
--  Aucune politique RLS → écriture et lecture par la clé de service uniquement.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists visites (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  jour        date not null,
  chemin      text not null,
  espace      text not null check (espace in ('site', 'app')),
  visiteur    text not null,
  compte      text,
  connecte    boolean not null default false,
  appareil    text,
  langue      text,
  pays        text,
  referent    text
);
create index if not exists visites_jour_idx on visites (jour);
alter table visites enable row level security;

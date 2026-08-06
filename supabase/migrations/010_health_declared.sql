-- ============================================================
-- Pacevo — « J'ai répondu à la question santé »
--
-- Sans ce drapeau, un athlète en parfaite santé est indiscernable d'un athlète
-- qui n'a jamais ouvert la section : dans les deux cas les tableaux sont vides.
-- Le coach IA ne saurait pas s'il peut faire confiance à ce vide, et le bandeau
-- de complétion réclamerait l'information pour toujours.
-- ============================================================

alter table profiles
  add column if not exists health_declared boolean not null default false;

-- Les profils ayant déjà coché au moins une pathologie, une zone de blessure ou
-- écrit une note ONT répondu : on les marque rétroactivement.
update profiles
   set health_declared = true
 where health_declared = false
   and (coalesce(array_length(health_conditions, 1), 0) > 0
     or coalesce(array_length(injury_zones, 1), 0) > 0
     or nullif(btrim(coalesce(health_notes, '')), '') is not null);

comment on column profiles.health_declared is
  'true = l''athlète a répondu à la section santé (y compris « rien à signaler »). Distingue « rien » de « pas encore demandé ».';

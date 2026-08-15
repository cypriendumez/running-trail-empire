-- ─────────────────────────────────────────────────────────────────────────────
--  026 — DEUX SÉANCES PAR JOUR.
--
--  Les professionnels doublent en permanence, et beaucoup d'amateurs à gros volume
--  aussi. Le plan ne savait pas le faire : il posait UNE séance par jour et se
--  contentait d'un conseil dans le texte (« scinde en deux sorties »), que rien ne
--  transformait en séances réelles — ni sur le calendrier, ni sur la montre.
--
--  C'est une OPTION, jamais un automatisme : doubler impose une organisation
--  quotidienne que tout le monde ne veut pas. Défaut FAUX, donc, comme les autres
--  réglages qui engagent l'athlète.
--
--  Ce que le drapeau NE décide PAS : le coach vérifie ensuite le volume, la fraîcheur,
--  l'absence de douleur et la période (jamais en affûtage). Quand il refuse, il DIT ce
--  qui manque — une case cochée qui ne produit rien est un mensonge silencieux.
--
--  Aucune instruction DROP : une colonne, rien d'autre. Les politiques RLS de
--  `profiles` portent sur la ligne et couvrent déjà cette colonne.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists double_sessions boolean not null default false;

comment on column profiles.double_sessions is
  'L''athlète accepte deux séances par jour (matin + soir). Le coach décide ensuite si son volume et sa fraîcheur le permettent.';

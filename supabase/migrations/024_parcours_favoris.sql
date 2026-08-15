-- ─────────────────────────────────────────────────────────────────────────────
--  024 — METTRE UN CŒUR SUR UN PARCOURS.
--
--  Enregistrer un parcours fonctionnait déjà (table `user_routes`, Trail Builder).
--  Ce qui manquait, c'est de RETROUVER celui qu'on refait toutes les semaines : la
--  liste est triée par date de création, si bien que le parcours favori descend un peu
--  plus bas à chaque nouveau tracé, jusqu'à disparaître sous les essais abandonnés.
--
--  Un simple drapeau suffit. Pas de table de jointure : un parcours appartient déjà à
--  UN athlète (RLS `own routes`), donc « favori » est une propriété du parcours
--  lui-même, pas une relation entre deux entités. Une table `route_favorites` serait
--  une complication sans usage.
--
--  Aucune instruction DROP : les politiques RLS existantes de `user_routes` couvrent
--  déjà la nouvelle colonne — elles portent sur la LIGNE, et la ligne appartient à son
--  athlète. Rien à modifier de ce côté.
-- ─────────────────────────────────────────────────────────────────────────────

alter table user_routes add column if not exists is_favorite boolean not null default false;

comment on column user_routes.is_favorite is
  'Parcours mis en favori par son auteur : remonte en tête de sa liste.';

-- Les favoris d'abord, puis les plus récents. L'index suit exactement le tri de
-- l'écran : sans lui, PostgreSQL relit toute la liste de l'athlète à chaque affichage.
create index if not exists idx_user_routes_favoris
  on user_routes (user_id, is_favorite desc, created_at desc);

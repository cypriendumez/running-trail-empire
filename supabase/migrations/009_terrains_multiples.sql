-- ============================================================
-- Pacevo — Terrains MULTIPLES
-- Un coureur alterne souvent route en semaine et sentier/sable le week-end.
-- `main_terrain` (choix unique) devient `main_terrains` (tableau).
-- Nouveaux terrains disponibles : sentier, tapis, neige.
-- ============================================================

alter table profiles
  add column if not exists main_terrains text[] default '{}';

-- Reprise des valeurs déjà saisies en mono-choix.
-- « mixte » signifiait « route + sentier » : on le déplie plutôt que de le perdre.
update profiles
   set main_terrains = case
         when main_terrain = 'mixte' then array['plat','sentier']
         when main_terrain is not null then array[main_terrain]
         else '{}'
       end
 where main_terrain is not null
   and (main_terrains is null or main_terrains = '{}');

comment on column profiles.main_terrains is
  'Terrains habituels (slugs, multiples) : plat, vallonne, montagne, plage, piste, sentier, tapis, neige';

-- `main_terrain` (singulier) est conservée le temps que le code déployé bascule.
-- Une fois la nouvelle version en ligne et vérifiée, elle peut être supprimée :
--   alter table profiles drop column main_terrain;

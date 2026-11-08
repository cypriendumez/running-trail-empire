-- ─────────────────────────────────────────────────────────────────────────────
--  039 — Une course supprimée redirige vers sa jumelle conservée.
--
--  Search Console, rapport vu le 29/10/2026 : dix fiches en 404 (Trail du Buis
--  21 km, Volvic 17 km, quatre formats du Trail de Haute Provence…). Toutes
--  avaient été effacées par le rafraîchissement du mardi parce qu'elles
--  existaient en double ; l'exemplaire conservé vit sous un autre identifiant.
--  L'adresse déjà connue de Google tombait en 404 et perdait tout ce qu'il
--  savait d'elle, au lieu de le transmettre à la jumelle.
--
--  Un DÉCLENCHEUR plutôt qu'une écriture dans chaque script : sept chemins de
--  code suppriment des courses (dédoublonnage, application finishers, retrait
--  des non-courses…) ; il les couvre tous, et ceux qui viendront.
--
--  La clé est le PRÉFIXE de 8 caractères : c'est tout ce que porte l'adresse
--  publique (/courses/<mots>-<8 caractères>).
--
--  Aucune instruction destructive (invariant du projet : migrations ≥ 007).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.races_redirections (
  ancien_court text primary key check (ancien_court ~ '^[0-9a-f]{8}$'),
  nouvel_id    uuid not null,
  cree_le      timestamptz not null default now()
);

-- Lue par le serveur seulement (clé de service) : RLS sans politique = fermée au public.
alter table races_redirections enable row level security;

create or replace function public.races_noter_jumelle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jumelle uuid;
begin
  begin
    -- MÊME RÈGLE que l'appariement des formats (`tolere` dans lib/races/majFinishers) :
    -- même nom, même ville, distance à 2,5 % près (0,25 km au moins). Une course sans
    -- équivalent assez proche n'a pas de jumelle : son adresse répond 404, comme avant.
    -- Déclencheur AFTER : la recherche ne voit plus aucune ligne effacée par la même
    -- instruction, donc jamais une jumelle supprimée dans le même lot.
    select r.id into jumelle
      from races r
     where r.id <> old.id
       and old.distance_km is not null
       and lower(btrim(r.name)) = lower(btrim(old.name))
       and lower(btrim(coalesce(r.city, ''))) = lower(btrim(coalesce(old.city, '')))
       and abs(r.distance_km - old.distance_km) <= greatest(0.25, old.distance_km * 0.025)
     order by abs(r.distance_km - old.distance_km), r.created_at, r.id
     limit 1;

    if jumelle is not null then
      insert into races_redirections (ancien_court, nouvel_id)
      values (left(replace(old.id::text, '-', ''), 8), jumelle)
      on conflict (ancien_court) do update set nouvel_id = excluded.nouvel_id, cree_le = now();
      -- Les adresses qui menaient à la ligne effacée mènent désormais à sa jumelle :
      -- jamais de chaîne de redirections.
      update races_redirections set nouvel_id = jumelle where nouvel_id = old.id;
    end if;
  exception when others then
    -- ⚠️ NE JAMAIS EMPÊCHER UNE SUPPRESSION : le dédoublonnage passe avant la
    -- redirection. Au pire, l'adresse répond 404, comme avant cette migration.
    raise warning 'races_noter_jumelle (%) : %', old.id, sqlerrm;
  end;
  return old;
end $$;

create or replace trigger races_noter_jumelle
  after delete on public.races
  for each row execute function public.races_noter_jumelle();

-- Rattrapage : les dix adresses relevées par la Search Console (explorées les 22 et
-- 23/10/2026). Jumelles retrouvées en lecture seule avec la règle ci-dessus.
insert into public.races_redirections (ancien_court, nouvel_id) values
  ('a42fbfe9', '4238ed20-9b79-49ef-a9e5-719fa226ae27'),  -- Volvic Volcanic Experience 17 km
  ('7e054763', 'a241650c-92d2-4bbf-8d38-1c23e13ef7b6'),  -- Volvic Volcanic Experience 21 km
  ('13f17da6', '31d73399-8f96-42f3-97b7-b5ce6c6df8d1'),  -- Trail de Haute Provence 80 → 78,4 km
  ('1051eb61', 'dae1a4cc-c9d4-43c7-a6a1-bb56e0d48f64'),  -- Trail de Haute Provence 65 → 64,5 km
  ('6cf9000a', '1fd4c0b0-3d9e-48f5-b3e1-61bf214692a2'),  -- Trail de Haute Provence 160 km
  ('709afc07', '6cb5e2ec-fde6-4716-aa63-b5afab0a41c3'),  -- Trail de Haute Provence 50 → 49,5 km
  ('3ed243d4', '0b87f4a8-00a4-43ff-b13d-6913340fe412'),  -- Trail du Buis 21 km
  ('d63216a0', '0386bbc2-68f8-4b61-8b71-6b19eeb2e443'),  -- Trail du Buis 10 km
  ('b046f7e7', '39a170a0-d7e4-4258-be88-3d47ab5f45aa'),  -- Corrida de Saint-Memmie 9 → 8,8 km
  ('f90c4a99', 'cd817226-f143-4706-ad0f-4475afa208e8')   -- Corrida d'Halloween (Saugues) 5 km
on conflict (ancien_court) do nothing;

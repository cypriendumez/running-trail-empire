-- ============================================================
-- Pacevo — Offres produits RÉELLES (flux d'affiliation)
--
-- La boutique affichait un catalogue ENTIÈREMENT GÉNÉRÉ : produits, prix et
-- disponibilités inventés, attribués à de vraies enseignes (i-Run, Alltricks,
-- Lepape, Ekosport, Décathlon) avec leurs vraies adresses. Aucun écran ne le
-- signalait. Un athlète pouvait fonder un achat dessus.
--
-- Décision : la boutique affiche de VRAIES offres, ou rien. Cette table reçoit les
-- flux d'affiliation officiels (Awin, Effiliation, Amazon PA-API…) via
-- /api/shop/import-feed — qui ne scrape aucun site et exige un secret.
--
-- Tant qu'elle est vide, la boutique affiche un écran d'attente honnête plutôt
-- qu'un catalogue fabriqué.
-- ============================================================

create table if not exists product_offers (
  id            uuid primary key default gen_random_uuid(),
  external_id   text not null,               -- identifiant du produit chez le marchand
  retailer      text not null,               -- enseigne (issue du flux, jamais inventée)
  product_name  text not null,
  brand         text,
  category      text,
  ean           text,                        -- code-barres : seule clé fiable entre enseignes
  price         numeric(8,2) not null,
  currency      text not null default 'EUR',
  url           text not null,               -- lien affilié fourni par le programme
  image_url     text,
  in_stock      boolean default true,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Une offre = un produit chez un marchand. Ré-importer un flux met à jour, n'empile pas.
create unique index if not exists product_offers_retailer_external_idx
  on product_offers (retailer, external_id);
create index if not exists product_offers_ean_idx on product_offers (ean) where ean is not null;
create index if not exists product_offers_search_idx on product_offers (category, brand, price);

-- Catalogue public en lecture : aucune donnée personnelle.
--
-- La politique est créée dans un bloc conditionnel plutôt qu'avec un `drop policy` :
-- PostgreSQL n'accepte pas `create policy if not exists`, et un `drop` — même
-- parfaitement inoffensif ici — fait afficher à Supabase un avertissement d'opération
-- destructive. Autant ne pas habituer l'œil à valider ce genre de fenêtre.
alter table product_offers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_offers' and policyname = 'product_offers_read'
  ) then
    create policy "product_offers_read" on product_offers for select using (true);
  end if;
end $$;

comment on table product_offers is
  'Offres issues de flux d''affiliation OFFICIELS. Aucune donnée inventée : si la table est vide, la boutique affiche un écran d''attente.';

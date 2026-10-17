-- 037 — LIMITEUR DE DÉBIT PARTAGÉ (constat d'audit M3, 16/10/2026)
--
-- ⚠️ LE LIMITEUR ÉTAIT EN MÉMOIRE PAR INSTANCE (src/lib/auth/limiteur.ts). Sur Vercel
-- (serverless, plusieurs instances), chaque instance avait son compteur : la limite réelle
-- valait un multiple de la limite annoncée. L'anti-énumération de /api/auth/{statut,reset,
-- confirmation} (qui disent si une adresse est inscrite) était donc un ralentisseur, pas un mur.
--
-- Ici, un compteur PARTAGÉ en base : une fonction atomique `rate_limit_hit` incrémente le
-- compteur de la fenêtre courante et dit si l'appel passe. `insert … on conflict … returning`
-- est atomique, donc juste même sous des appels simultanés.
--
-- ⚠️ LE CODE RETOMBE SUR LA MÉMOIRE LOCALE si cette fonction manque ou si la base ne répond
-- pas (voir `autoriserPartage`) : tant que cette migration n'est pas passée, rien ne casse,
-- on est au comportement d'avant.
--
-- ⚠️ À LANCER À LA MAIN dans l'éditeur SQL de Supabase. Pas de RPC `exec_sql` sur ce projet.

create table if not exists public.rate_limits (
  cle            text        not null,
  fenetre_debut  timestamptz not null,
  compte         int         not null default 0,
  primary key (cle, fenetre_debut)
);

-- RLS activée SANS politique : la table n'est touchée que par la fonction `security definer`
-- ci-dessous (donc par le propriétaire), jamais directement par anon/authenticated.
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(p_cle text, p_fenetre_ms bigint, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ms     bigint := greatest(coalesce(p_fenetre_ms, 1), 1);
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp()) * 1000 / v_ms) * v_ms / 1000.0);
  v_compte int;
begin
  insert into public.rate_limits (cle, fenetre_debut, compte)
  values (p_cle, v_bucket, 1)
  on conflict (cle, fenetre_debut) do update set compte = public.rate_limits.compte + 1
  returning compte into v_compte;

  -- Ménage borné : on retire les fenêtres passées de CETTE clé (au plus une ligne active/clé).
  delete from public.rate_limits where cle = p_cle and fenetre_debut < v_bucket;
  -- Et, de loin en loin, un ménage global des lignes abandonnées (clés qui ne reviennent pas).
  if random() < 0.01 then
    delete from public.rate_limits where fenetre_debut < now() - interval '1 day';
  end if;

  return v_compte <= p_max;  -- true = l'appel est autorisé
end;
$$;

-- La fonction n'est appelée que côté serveur, par la clé de service. On la ferme à tout le reste.
revoke all on function public.rate_limit_hit(text, bigint, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, bigint, int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
--  031 — LES ABONNEMENTS AUX NOTIFICATIONS PUSH
--
--  ⚠️ LE CODE EXISTE DEPUIS LE 13/09/2026, LA TABLE NON. `/api/push/subscribe`,
--  `/api/push/unsubscribe` et `lib/push/envoyer` sont livrés et appellent
--  `push_subscriptions` — qui n'a jamais été créée. Vérifié le 23/09/2026 : aucune
--  migration ne la contient. Un athlète qui active les notifications écrit donc dans
--  une table inexistante.
--
--  Le contrat est repris EXACTEMENT du code, pas inventé :
--    · écriture  : upsert { user_id, endpoint, p256dh, auth, user_agent }
--                  avec `onConflict: "endpoint"` → `endpoint` doit être UNIQUE ;
--    · lecture   : select endpoint, p256dh, auth where user_id = …
--    · nettoyage : delete where endpoint = … (abonnement mort, 404/410 du navigateur)
--                  et delete where endpoint = … and user_id = … (désabonnement).
--
--  ⚠️ TOUS CES ACCÈS PASSENT PAR LA CLÉ DE SERVICE, qui ignore la RLS. La politique
--  ci-dessous ne sert donc à rien aujourd'hui — elle sert le jour où un composant
--  client interrogera la table directement, et elle évite qu'une table de données
--  personnelles reste ouverte par défaut. Elle est écrite en connaissance du piège :
--  une table avec RLS mais SANS politique refuse l'écriture à son propre
--  propriétaire, et ça ne se voit pas avec la clé anonyme.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- L'URL que le navigateur donne pour joindre CE navigateur-là. Unique : c'est la
  -- clé de conflit de l'upsert, et un même appareil ne doit pas s'inscrire deux fois.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  -- Sert à dire à l'athlète QUEL appareil est abonné. Tronqué à 300 par le code.
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- La lecture se fait toujours par athlète : l'index suit l'usage réel.
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- ⚠️ PAS DE `drop policy`, MÊME « if exists ». L'éditeur SQL de Supabase signale toute
-- instruction DROP comme destructive et impose une confirmation « Potential issue
-- detected » : ça oblige à trancher soi-même un risque qui n'existe pas ici. Sur une
-- table neuve la politique n'existe pas encore ; ce bloc la crée une fois et ne fait
-- rien si on rejoue la migration.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions_self'
  ) then
    create policy push_subscriptions_self on public.push_subscriptions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

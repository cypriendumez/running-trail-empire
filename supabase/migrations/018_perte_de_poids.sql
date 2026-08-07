-- ============================================================
-- Pacevo — Mode perte de poids : pesées horodatées + réglages
--
-- POURQUOI UNE TABLE ET PAS UNE COLONNE
-- `profiles.weight_kg` existait déjà, mais c'est UNE valeur écrasée à chaque mise à
-- jour : aucune histoire, donc aucune tendance. Or le poids d'un jour varie de ±1 à
-- 2 kg (hydratation, glycogène, digestion) : sans historique, la seule chose qu'on
-- pourrait afficher serait la différence entre deux pesées — c'est-à-dire du bruit
-- présenté comme un résultat. Exactement le type de chiffre plausible-mais-faux que
-- l'audit a traqué toute une journée.
--
-- Avec l'historique, la vitesse de perte est calculée par régression sur ≥ 4 pesées
-- réparties sur ≥ 14 jours, et tant que ce seuil n'est pas atteint l'app dit
-- « pas encore assez de pesées » au lieu d'inventer une tendance.
--
-- Aucune instruction destructive : uniquement des créations conditionnelles.
-- ============================================================

create table if not exists weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  weight_kg   numeric(5,2) not null check (weight_kg > 30 and weight_kg < 300),
  -- Note libre de l'utilisateur (contexte d'une pesée : maladie, voyage, règles…).
  note        text,
  created_at  timestamptz not null default now()
);

-- Une pesée par jour et par personne : se peser deux fois dans la journée renseigne
-- sur l'hydratation, pas sur la masse grasse. Un ré-envoi met à jour, il n'empile pas.
create unique index if not exists weight_logs_user_date_idx on weight_logs (user_id, date);
create index if not exists weight_logs_user_recent_idx on weight_logs (user_id, date desc);

alter table weight_logs enable row level security;

-- Politiques créées dans un bloc conditionnel : PostgreSQL n'accepte pas
-- `create policy if not exists`, et un `drop policy` déclencherait l'avertissement
-- « opération destructive » de Supabase pour rien.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'weight_logs' and policyname = 'weight_logs_all_own'
  ) then
    create policy "weight_logs_all_own" on weight_logs for all using (auth.uid() = user_id);
  end if;
end $$;

comment on table weight_logs is
  'Pesées horodatées. Sert à calculer une TENDANCE (régression sur ≥ 4 points / ≥ 14 jours) ; en dessous de ce seuil l''app affiche « pas assez de pesées » plutôt qu''une progression inventée.';

-- ── Réglages du mode, sur le profil ─────────────────────────────────────────
alter table profiles
  add column if not exists weight_mode_enabled boolean not null default false,
  add column if not exists weight_goal_kg numeric(5,2) check (weight_goal_kg > 30 and weight_goal_kg < 300);

comment on column profiles.weight_mode_enabled is
  'Mode perte de poids activé VOLONTAIREMENT par l''athlète. Jamais activé automatiquement sur l''IMC : l''IMC ne distingue pas la masse musculaire, et annoncer à quelqu''un qu''il est en surpoids sans qu''il l''ait demandé n''est pas le rôle de l''app.';
comment on column profiles.weight_goal_kg is
  'Poids cible facultatif. Sans lui, le mode fonctionne quand même (cible calorique + protéines) mais n''affiche aucune projection d''échéance.';

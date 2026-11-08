---
name: auditer-rls
description: Vérifier qu'une table (ou une vue) Supabase de Pacevo protège vraiment les données de ses propriétaires sans refuser en silence leurs propres écritures. À utiliser avant de créer une table ou une vue, quand une écriture du navigateur est refusée (42501, « row-level security »), quand l'alerte Supabase « rls_disabled_in_public » arrive, et pour le contrôle mensuel de `@Vault`.
---

# Auditer la RLS d'une table

Méthode tirée de quatre défauts réels (mémoire du projet : `rls-status`, `rls-vues-et-politiques`, `rls-revoke-colonne-inefficace`). Tout se fait en LECTURE : le schéma se change par du SQL donné à Cyprien, qu'il exécute lui-même dans l'éditeur Supabase. Sur le Mac, le garde-fou `garde-supabase.mjs` met chaque `execute_sql` en lecture seule, une instruction par appel ; dans le cloud, envelopper soi-même : `begin transaction read only; …; commit;`.

## 1. Le catalogue (lecture seule)

```sql
-- RLS activée ?
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = '<table>';
-- Ses politiques, commande par commande
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = '<table>';
-- Les droits de TABLE (un revoke de colonne ne les annule pas)
select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = '<table>';
```

## 2. Les cinq pièges, un par un

1. **RLS activée SANS politique pour une commande** = l'écriture du propriétaire est refusée en silence. Le 14/09/2026, 100 % des inscrits voyaient « Erreur lors de la sauvegarde » (`performance_baselines`). Toute table écrite depuis le navigateur a une politique pour CHAQUE commande qu'il utilise (`select`, `insert`, `update`, `delete`), typiquement `using (auth.uid() = user_id)` et `with check (auth.uid() = user_id)`.
2. **Une politique ne peut pas joindre `profiles`** : la sous-requête subit la RLS de `profiles` (`profiles_select_own`), donc elle ne voit jamais autrui et la condition est fausse. Passer par une fonction `security definer` qui ne rend qu'un booléen, avec `set search_path = public`.
3. **Une VUE n'a pas de RLS** : son `grant` est la seule barrière. `revoke all … from public` ne suffit pas, Supabase accorde d'office à `anon` : il faut `revoke all on <vue> from anon` nommément, et des colonnes ÉNUMÉRÉES (jamais `intervals_api_key`, `email`, Stripe). Ne jamais « réparer » en ouvrant `profiles` en lecture : la RLS filtre des lignes, pas des colonnes.
4. **Un `revoke` de COLONNE ne fait rien** si le droit vient de la TABLE (grant Supabase par défaut à `authenticated`) : `has_column_privilege` reste vrai. Pour rendre une colonne immuable : déclencheur `BEFORE UPDATE` qui refuse le changement pour `authenticated`/`anon` seulement (le service role du webhook Stripe et des crons n'est pas bridé), comme `trg_profiles_colonnes_protegees`.
5. **Les catalogues publics** (`races`, `product_offers`, `segments`) sont lisibles par tous par choix ; leur écriture, elle, doit être refusée à `anon`.

## 3. Prouver par l'usage, pas par le catalogue

- **Clé anonyme** : lecture d'une table personnelle = 0 ligne (filtré, pas ouvert) ; écriture refusée. ⚠️ « Aucune erreur + 0 ligne » veut dire que la politique FILTRE. Un `update`/`delete` qui ne vise AUCUNE ligne réussit sans rien prouver : viser une ligne qui existe, avec une modification neutre (réécrire une valeur par elle-même).
- **Session d'un vrai utilisateur** : seule elle montre le refus silencieux du propriétaire (piège 1). La clé anonyme ne le voit pas, un refus étant attendu pour elle. Sans écrire en production : demander à Cyprien, ou rejouer sur une ligne de test qu'il autorise.
- **Le code** : le client utilisé compte. `createAdminClient()` (service role) contourne la RLS, donc une route qui écrit avec lui doit filtrer elle-même par `user_id` de la SESSION, jamais par un identifiant venu du corps de la requête.

## 4. Figer

Un test dans `tests/` qui lit la migration ou le code et rougit si la politique, le `revoke … from anon` ou le filtre `user_id` disparaît (modèle : `tests/bugs-visites.test.ts`, les tests RLS de `tests/coach.test.ts`). Preuve par mutation (`/mutations`).

## Rendu

```
Table : <nom> — RLS <oui|non> — politiques : <select, insert…>
Écrite depuis : <navigateur | serveur (service role) | les deux>
Pièges : <n° et constat, ou aucun>
Preuve par l'usage : <clé anonyme : … | session : … | non faite : pourquoi>
SQL à donner à Cyprien : <bloc | aucun>
```

Le dépôt est public : une faille NON corrigée ne s'écrit ni dans un fichier, ni dans un commit, ni dans une PR. Elle va dans le compte-rendu privé, avec son SQL.

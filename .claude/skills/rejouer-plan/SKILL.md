---
name: rejouer-plan
description: Rejouer en local, en LECTURE SEULE, le plan que le coach de Pacevo construit pour un vrai athlète à partir de ses vraies données, pour auditer ses choix (volume, sortie longue, affûtage, reprise, allures) sans rien écrire en base ni rien pousser sur la montre. À utiliser quand Cyprien ou un coureur conteste une séance, avant de commercialiser une règle du coach, et après une course ou un silence de montre.
---

# Rejouer le plan d'un athlète

Méthode du 05/11/2026 (mémoire du projet : `audit-plan-05-11`). Ce jour-là, neuf défauts n'apparaissaient QUE sur des données réelles après une course et un silence de montre (14 km visés pour un coureur à 70 km/semaine, affûtage de 3 semaines pour un 5 km…) : aucun test synthétique ne les avait vus.

## Règles

- Lecture seule, sans exception : le faux client lève une erreur sur TOUTE écriture.
- Les données de santé restent sur le Mac : rien dans le dépôt (public), rien dans une PR, rien dans la conversation au-delà de ce que l'audit exige (on montre des séances et des écarts, pas des valeurs de FC ou de VFC brutes).
- Le script vit dans le scratchpad de la session, jamais dans le dépôt.

## 1. Lire les données de l'athlète

Script `tsx` (extension `.mts` pour l'`await` de haut niveau) qui, avec le service role, fait uniquement des `select` sur les tables qu'utilise `buildAthleteContext` (`src/lib/ai/coachContext.ts`) : `profiles`, `workouts`, `performance_baselines`, `notifications`, `hrv_data`, `sleep_data`, `shoes`… Avant de garder les lignes :
- retirer les secrets du profil (`intervals_api_key` et tout jeton) ;
- supprimer `last_lat` / `last_lon` : sans position, pas d'appel météo.

Importer supabase-js et `coachContext` par **chemin absolu** (`<dépôt>/node_modules/@supabase/supabase-js/dist/index.cjs`), et lancer avec `npx --yes tsx` depuis le dépôt ou le worktree (il n'y a pas de `tsx` local).

## 2. Un faux client EN MÉMOIRE

Il sert les lignes lues à l'étape 1 et applique `eq`, `neq`, `gte`, `lte`, `in`, `order`, `limit`, `maybeSingle`, `single`. Toute écriture (`insert`, `update`, `upsert`, `delete`, `rpc`) lève une erreur : si le coach essaie d'écrire, l'audit le voit au lieu de l'exécuter.

## 3. Construire le plan

`buildAthleteContext(fauxClient, userId, lecture)` puis `buildWeekPlan(contexte, jour)` (`src/lib/ai/autoPlan.ts`). C'est le moteur déterministe réel, sans LLM. `lecture` règle ce que la formule de l'athlète permet de lire (`{}` = lecture complète, `{ essentielle: true }` = Starter, `{ objectifSeul: true }` = gratuit) : rejouer avec celle de SON abonnement. `jour` fixe le départ du plan ; le contexte, lui, lit aussi l'horloge, d'où le préchargement de l'étape 4.

## 4. Lire le plan correctement

- **Par date et créneau, jamais `plan[i]`** : un jour peut porter deux séances (renforcement, double seuil).
- Rejouer sur **sept jours de départ** : le placement dépend du jour où le plan démarre. Préchargement qui décale `Date` (module à recréer dans le scratchpad, voir la mémoire `plan-lire-par-date`) : `DECALAGE_JOURS=n npx tsx --import ./date-decalee.mjs <script>`.
- Situations à tester en priorité : J+1 à J+21 après une course, montre muette 5 à 30 jours, reprise après blessure, semaine de récupération, affûtage selon la distance (1 semaine pour 5-10 km, 2 pour un semi, 3 pour un marathon).

## 5. Juger

Pour chaque séance, la question n'est pas « est-ce plausible ? » mais « quelle règle l'a produite, et cette règle est-elle juste pour CET athlète ? ». Croiser avec le motif affiché (`why`) et les sources du coach (Daniels, Bosquet 2007…). Un défaut trouvé devient :
1. un test dans `tests/` sur une situation fabriquée qui reproduit le cas (sans donnée réelle), lu par date, rejoué sur sept départs ;
2. la correction au plus près de la cause dans `src/lib/coach/*` ou `autoPlan.ts` ;
3. la preuve par mutation (`/mutations`) ;
4. une PR de Niveau 2 : modifier le coach se fait sur « GO » de Cyprien.

## Rendu

```
Athlète : <initiale ou « compte de Cyprien »>, situation : <J+n après …, montre muette n jours…>
Départs rejoués : <7 | lesquels>
Séances contestables : <date, séance, règle en cause, ce qu'elle devrait faire, source>
Corrigé : <commit / PR | non : pourquoi>
```

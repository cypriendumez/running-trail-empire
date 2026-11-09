# `@Sparring` : les 8 profils de coureurs à simuler

*Préparé le 08/11/2026. Le coach (`buildWeekPlan`, `src/lib/ai/autoPlan.ts`) est déterministe,
sans LLM : il n'y a pas de « prompt système du coach » à tester, on teste le code.*

## Ce qui existe déjà

`tests/profils.crash.test.ts` passe 10 archétypes dans `buildWeekPlan` (contexte fabriqué à la
main) et vérifie 7 invariants : semaine complète et lisible, aucune valeur technique dans le
texte, jamais deux jours durs collés, budget de qualité respecté, jours indisponibles vides,
charge ≤ cible, feu rouge = pas de séance dure, sans montre = aucune allure inventée.

Archétypes déjà couverts : débutant 3 j/12 km, marathonien en 5 h, élite 110 km/7 j, sans
montre, sans VFC ni sommeil, reprise après coupure, feu rouge, traileur 55 km, 1 seul jour
disponible, canicule.

## La matrice (profils de la constitution → état)

| # | Profil | Entrées clés à fixer | Ce qu'un plan sensé DOIT faire | Ce qui serait absurde | Couvert ? |
|---|---|---|---|---|---|
| 1 | Débutant | `peut_courir_30min = false`, VMA inconnue, 3 j | Marche-course en 11 étapes, aucune séance de qualité, aucun test VMA imposé | Une séance de seuil ; une allure chiffrée sans VMA | Oui (débutant) ; la marche-course a ses propres tests |
| 2 | Marathonien sub-3 h | VMA ≈ 17,5, 70–90 km/sem, 5–6 j, marathon à 12 sem | Allure marathon ≈ 4'15/km dans le spécifique, sortie longue 28–35 km, affûtage 3 sem | Sortie longue < 20 km ; affûtage de 1 sem ; allure marathon plus lente que le footing | **Non** : seul le marathonien 5 h existe |
| 3 | Traileur | Objectif trail 55 km, D+ connu, 60 km/sem | Sortie longue en durée, travail en côte, allures données à l'effort | Allures de route au km sur du D+ | Oui (traileur) |
| 4 | Reprise après blessure | 0 km la semaine passée, douleur déclarée « mieux » | Reprise Daniels 50 % puis 75 %, aucune intensité, message qui renvoie au médecin si douleur | Fractionné la 1re semaine ; un diagnostic | Oui (reprise) ; à croiser avec `@SafeRun` |
| 5 | Cycliste venant au running | Gros volume vélo (sports croisés), 0 historique course, FC max connue | Volume de course bas (tendons), vélo compté en charge cardio mais pas en charge jambes-impact | Volume de course calé sur la charge totale vélo comprise | **Non** |
| 6 | Senior (60 ans +) | Âge 62, VMA 12, 4 j | Au plus 1–2 séances dures, récupération plus longue, renforcement conservé | 3 séances dures ; FC max « 220 − âge » affichée comme mesure | **Non** (le coach lit-il l'âge ? à vérifier avant d'écrire le test) |
| 7 | Emploi du temps chaotique | Jours qui changent chaque semaine, séances manquées | Le plan suit les jours déclarés, une séance manquée ne se « rattrape » pas en doublant | Deux séances dures le lendemain d'un trou | **Partiel** (1 seul jour dispo) |
| 8 | Élite sub-33' au 10 km | VMA ≈ 20,5, 110 km/sem, 10 km dans 8 sem | Affûtage 1 sem, VMA + seuil, double seuil si l'option est cochée | Affûtage de 3 sem pour un 10 km | Oui (élite) ; ajouter l'objectif 10 km |

## Ce que `@Sparring` fait à chaque passage (lundi)

1. Lit `ops/memory/LESSONS_LEARNED.md`, puis `git log` depuis son dernier passage sur `src/lib/coach/`, `src/lib/ai/autoPlan.ts`, `src/lib/ai/coachContext.ts`. Rien de changé → `RAS` et arrêt.
2. Lance `npx tsx tests/profils.crash.test.ts` et les tests du plan (`plans`, `plan-reprise`, `plan-gratuit`).
3. Ajoute un profil manquant de la matrice par passage (n° 2, 5, 6, 7 d'abord), avec des candidats réels (jamais une liste vide) et une mutation qui le fait rougir.
4. Un plan absurde → PR « Coach : … » avec le test qui le prouve. **Niveau 2** : aucune fusion sans le « GO » de Cyprien.

`@SafeRun` rejoue ensuite : aucune réponse d'IA ni du plan ne pose de diagnostic (le Kiné IA est retiré depuis le 09/11/2026 : s'il réapparaît, c'est un défaut), la mention « consulte un médecin ou un kinésithérapeute » est présente dès qu'une douleur est déclarée.

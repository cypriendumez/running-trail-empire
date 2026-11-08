---
name: double-relecture
description: Faire relire un changement de Pacevo par DEUX sous-agents indépendants avant qu'il parte (pull request, commit, fusion, article publié) ; les deux doivent passer, sinon on corrige et on relance deux relecteurs neufs, deux fois au plus, puis on rend la main à Cyprien. À utiliser pour tout ce qui atteint les coureurs (coach, plan, montre, santé, paiement, article public), et dans les routines avant d'ouvrir leur PR. Inutile pour un brouillon interne ou une vérification qu'un script tranche seul.
---

# Double relecture

Celui qui a écrit un changement le relit avec les mêmes angles morts. Deux relecteurs qui n'ont rien écrit et ne se voient pas l'un l'autre cassent cet effet. Méthode adaptée de la « Santa Method » du dépôt ECC (MIT) ; voir la fiche de la bibliothèque du 08/11/2026.

## Avant : ce qu'un script tranche, un script le tranche

D'abord `npm run verify` (skill `/verifier`). Rouge → on corrige, pas de relecture. La double relecture vérifie ce que tsc et les tests ne voient pas.

## 1. Choisir les relecteurs

| Changement | Relecteur A | Relecteur B |
|---|---|---|
| Correction de bug, code serveur | `relecteur-independant` | `chasseur-echecs-muets` |
| Test ajouté ou modifié | `relecteur-tests` | `relecteur-independant` |
| Coach, plan, montre | `relecteur-independant` | `relecteur-independant` (2e appel, neuf) |
| Article de blog, texte public sourcé | `verificateur-sources` | `verificateur-sources` (2e appel, neuf) |
| Données de coureur, santé, partage | `gardien-donnees-sante` | `relecteur-independant` |

## 2. Les lancer

Les DEUX appels de l'outil Agent partent dans le même message (en parallèle), avec le même texte :

```
But du changement : <le défaut corrigé, avec sa source : message d'error_logs, PR, demande de Cyprien>
Ce qu'il ne doit pas faire : <limites : aucun test affaibli, aucune écriture en base, rien hors du but…>
À lire : `git diff origin/main...HEAD` (ou la liste des fichiers)
Tu n'as pas écrit ce changement. Cherche ce qui ne va pas. Rends ton verdict dans ton format.
```

Ne donne jamais à un relecteur l'avis de l'autre, ni ton propre avis (« je pense que c'est bon »).

## 3. Décider

- Les deux rendent PASSE → ça part.
- Un seul ÉCHOUE → c'est un vrai problème : l'autre l'a manqué. On réunit les bloquants des deux, sans doublon.
- Un relecteur qui dit « non vérifiable » sur un point vital (une source, une preuve par mutation) compte comme ÉCHOUE.

## 4. Corriger, relancer, s'arrêter

1. Corriger SEULEMENT les bloquants, sans rien ajouter d'autre.
2. Relancer `npm run verify`, puis DEUX relecteurs NEUFS (nouveaux appels, sans l'historique du tour précédent).
3. Au plus 2 tours de correction. Encore un ÉCHOUE au 3e verdict : on s'arrête. Dans une routine, la PR s'ouvre quand même, avec une section « Relecture : bloquants non levés » qui recopie les bloquants, et le titre commence par `[À REVOIR]`. En session, on le dit à Cyprien.

## 5. Laisser une trace

Dans le corps de la PR ou le compte-rendu :

```
Double relecture : <relecteur A> + <relecteur B>, <n> tour(s)
Bloquants levés : <liste courte>
Bloquants restants : <liste | aucun>
```

Un bloquant qui révèle un piège nouveau devient une ligne de `ops/memory/LESSONS_LEARNED.md` (format `[Date] [@Agent] Erreur -> Cause racine -> Règle`).

## Ce que la double relecture ne remplace pas

- La preuve par mutation (skill `/mutations`).
- La décision de Cyprien : PASSE ne vaut pas fusion ni déploiement.
- Le coût : chaque relecteur consomme la même limite d'usage que les sessions de Cyprien. Dans une routine, un seul tour de relecture par PR quand le changement ne touche pas les coureurs.

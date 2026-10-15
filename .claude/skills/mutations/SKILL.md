---
name: mutations
description: Prouver qu'un test de Pacevo peut réellement échouer, en mutant le code qu'il garde. À utiliser après avoir écrit ou modifié un test, et quand on demande de « vérifier par mutation ».
---

# Vérifier un test par mutation

Un test vert qui ne peut pas rougir est pire que pas de test. Pour chaque assertion :

1. **Muter le code gardé, pas le test** : la plus petite modification qui réintroduit le défaut visé (retirer une
   borne, une règle, un élément d'un ensemble ; revenir à l'ancien appel). Vérifier d'abord que le motif remplacé
   n'apparaît qu'UNE fois dans le fichier.
2. **Lancer le seul fichier de test et exiger les deux** :
   - `npx tsx tests/<nom>.test.ts > /dev/null 2>&1; echo "exit = $?"` → **1** (un `✗` affiché après le résumé ne
     fait rien échouer) ;
   - le test visé en `✗` avec le message `KO` attendu : dans un test à plusieurs assertions, seule la première qui
     échoue s'affiche.
3. **Restaurer toujours** (dans un `finally`) et comparer les empreintes `shasum` avant et après la campagne.
4. **Listes en boucle** : seul le premier élément en échec apparaît ; prouver chaque élément à part en évaluant son
   prédicat sous chaque mutation.
5. **Une mutation qui ne rougit pas** : prouver l'inertie (comparer les sorties sur une trentaine d'entrées) avant de
   conclure à une garde redondante ; sinon c'est un trou de test.
6. **Contre-poids** : un filtre facile à élargir a besoin d'un test dans l'autre sens (par exemple les statuts qui ne
   doivent PAS être passagers).
7. **Ne jamais épingler un défaut connu** : un test qui exige le trou rougira le jour où on le comble.

Modèle de campagne : une liste `[nom, fichier, avant, après, tests attendus en ✗]`, appliquée une par une avec
`spawnSync`, restauration en `finally`, verdict « code de sortie 1 + test visé en ✗ ».

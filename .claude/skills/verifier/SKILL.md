---
name: verifier
description: Lancer la vérification complète de Pacevo (tsc + toute la suite de tests) et en lire le VRAI résultat, y compris depuis un worktree de session. À utiliser avant tout commit, toute fusion ou tout déploiement, ou quand on demande « npm run verify ».
---

# Vérifier Pacevo

1. **Préparer l'arbre** (worktree de session sous `.claude/worktrees/`) :
   - `node_modules` absent → lien symbolique vers celui du dépôt principal (ignoré par git) ;
   - ⚠️ **jamais de `npm ci` ni de `npm install` tant que `node_modules` est un LIEN** : npm vide d'abord le
     dossier, la suppression suit le lien et vide celui du dépôt principal (constaté le 15/10/2026 : le
     `node_modules` de main est passé à 0 entrée pendant qu'une autre session travaillait). Pour changer les
     dépendances d'un worktree : `rm node_modules` (SANS barre finale : retire le lien seul), puis `npm ci` ;
   - `next-env.d.ts` absent (fichier généré, ignoré) → le recréer, sinon `tsc` échoue en TS2307 sur les images :
     ```
     /// <reference types="next" />
     /// <reference types="next/image-types/global" />
     ```
2. **Lancer en arrière-plan en journalisant le code de sortie** :
   `npm run verify > <journal> 2>&1; echo "EXIT $?" >> <journal>`.
   Le code rendu par la tâche d'arrière-plan est celui du dernier `echo`, pas celui de la suite : il ne prouve rien.
3. **Lire le verdict dans le journal** : la ligne `EXIT` (0 exigé), puis chercher `✗`, `KO ` et `error TS`.
   `npm test` enchaîne les fichiers par `&&` : vérifier que le DERNIER fichier de la chaîne (voir `package.json`) a
   bien affiché son résumé.
4. **Rapporter** la ligne `EXIT` et le nombre d'échecs tels quels. Un test rouge ne se « corrige » pas avant d'avoir
   vérifié s'il a raison.

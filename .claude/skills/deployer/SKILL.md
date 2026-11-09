---
name: deployer
description: Mettre Pacevo en production sur Vercel sans embarquer le travail d'une autre session ni retirer un correctif déjà en ligne. À utiliser UNIQUEMENT quand Cyprien a donné, dans la conversation en cours, son accord explicite pour ce déploiement.
---

# Déployer Pacevo

0. **Accord explicite de Cyprien, dans cette conversation, pour CE déploiement.** Sinon : s'arrêter et demander.
1. **Vercel téléverse le DISQUE, pas ce que git suit.** Déployer depuis un arbre propre (`git status` vide), construit
   à HEAD, et qui contient tout ce qui est déjà en production. Sinon, on retire des correctifs en ligne : lire le commit
   servi (`curl -s https://pacevo.fr/version.json`) et exiger `git merge-base --is-ancestor <commit servi> origin/main`.
   Jamais depuis le dépôt principal si une autre session y a des fichiers non commités. Avant l'envoi, repérer une
   preuve propre au changement : une page publique qui répond 404, ou un texte absent, et qui devra apparaître après.
2. Depuis un worktree propre (`git worktree add --detach <dossier> origin/main`) : copier `.vercel/` du dépôt
   principal (`cp -R`), lier `.env.local` par un lien symbolique (ne jamais copier les secrets) et recréer
   `next-env.d.ts` (ses deux lignes `/// <reference …>`, voir `/verifier`).
   ⚠️ **`node_modules` : une COPIE, jamais un lien.** Turbopack refuse un `node_modules` qui pointe hors du dossier
   (« Symlink [project]/node_modules is invalid ») : la vérification passe, la construction échoue, rien ne part
   (rejoué le 05/11 et le 08/11/2026). Faire `cp -c -R <dépôt>/node_modules node_modules` (copie instantanée APFS,
   sans place disque en plus), après avoir vérifié que le `node_modules` du dépôt principal est à jour
   (`npm ls --depth=0` sans erreur, version de `next` = celle de `package-lock.json`).
3. **Vérification, puis construction, séparément et en arrière-plan**, chacune journalisée avec sa ligne `EXIT` comme
   dans la compétence `/verifier` : `npm run verify` (`EXIT 0`, aucun ✗ ni `error TS`, résumé du dernier fichier de
   la chaîne), puis `find .next -name '* [0-9].*' -delete; npm run build` (`EXIT 0`). Après la construction, le seul
   fichier modifié est `public/version.json`, et il porte le commit de HEAD.
4. **Envoi** : `cd <worktree> && npx --yes vercel@54.14.0 deploy --prod --yes`, lancé par Claude.
   - Sur le Mac de Cyprien, une règle `permissions.ask` de `~/.claude/settings.json` couvre cette commande et
     `npm run deploie`. Elle passe AVANT le classifieur du mode auto, qui a refusé l'envoi malgré l'accord de
     Cyprien (09/11/2026) : Cyprien voit une fenêtre de confirmation et clique « Autoriser ». Le prévenir
     juste avant de lancer.
   - Pas de fenêtre et refus du mode auto : ne pas réessayer. Donner la commande à Cyprien, qui la lance lui-même.
   - Ne jamais remplacer cette règle par `permissions.allow` : n'importe quelle session pourrait alors déployer seule.
   - `FetchError … /v2/files … write EPIPE` : coupure réseau pendant le téléversement (le 09/11/2026, api.vercel.com
     répondait en 16 s). La production ne bouge pas : le vérifier, puis relancer la même commande.
   - `npm run deploie` enchaîne vérification, construction et envoi en une commande. Ne pas le relancer après
     l'étape 3 : il referait tout pour rien.
5. **Prouver la mise en ligne** : `npm run enligne` depuis le worktree (sort en 1 si la production est en retard), puis
   la preuve repérée à l'étape 1. Vercel reconstruit de son côté : les noms des fichiers JS diffèrent du build local.
   Un changement visible seulement après connexion se prouve par le commit servi.
6. Nettoyer : retirer le lien `.env.local` du worktree (`rm .env.local`, sans barre finale) et `.vercel/`, puis
   `git worktree remove --force <dossier>`. Vérifier que `.env.local` et `node_modules` du dépôt principal existent
   toujours.
7. **Variable d'environnement modifiée avant le déploiement** : elle ne s'applique qu'au déploiement SUIVANT. Une
   variable « sensible » (défaut de Vercel en production) se relit VIDE par `vercel env pull` : une valeur non secrète
   (adresse, texte légal) se pose avec `--no-sensitive` pour pouvoir prouver sa valeur.

---
name: deployer
description: Mettre Pacevo en production sur Vercel sans embarquer le travail d'une autre session ni retirer un correctif déjà en ligne. À utiliser UNIQUEMENT quand Cyprien a donné, dans la conversation en cours, son accord explicite pour ce déploiement.
---

# Déployer Pacevo

0. **Accord explicite de Cyprien, dans cette conversation, pour CE déploiement.** Sinon : s'arrêter et demander.
1. **Vercel téléverse le DISQUE, pas ce que git suit.** Déployer depuis un arbre propre (`git status` vide), construit
   à HEAD, et qui contient tout ce qui est déjà en production (sinon on retire des correctifs en ligne : comparer avec
   `npm run enligne`). Jamais depuis le dépôt principal si une autre session y a des fichiers non commités.
2. Depuis un worktree propre : copier `.vercel/` du dépôt principal (`cp -R`) et lier `.env.local` par un lien
   symbolique (ne jamais copier les secrets).
3. `npm run deploie` (vérification complète, construction, `vercel@54.14.0 deploy --prod`) : lire la ligne `EXIT` de
   la vérification comme dans la compétence `/verifier`.
4. **Prouver la mise en ligne** : `npm run enligne` (sort en 1 si la production est en retard), puis chercher un texte
   propre à ce changement dans un fichier JS servi par https://pacevo.fr.
5. Nettoyer : retirer `.vercel/` et le lien `.env.local` du worktree.

# Pacevo — consignes pour Claude

Application de coaching course à pied et trail (ex « Running & Trail Empire »), en ligne sur https://pacevo.fr.
Projet de Cyprien. Répondre en **français**.

## Pile
- Next.js 16 (App Router), React 19, TypeScript, Tailwind.
- Supabase (Postgres servi par PostgREST) ; Vercel en offre **Hobby** (une tâche planifiée Vercel ne tourne
  qu'une fois par jour : les autres passent par GitHub Actions) ; e-mails Resend ; IA Gemini ; montres via intervals.icu.

## Commandes
- `npm run verify` = `tsc --noEmit` + toute la suite. **Au vert avant tout commit et tout déploiement.**
- Un seul fichier de test : `npx tsx tests/<nom>.test.ts`. `npm run enligne` dit ce qui est écrit mais pas en ligne.
- Procédures détaillées : compétences `/verifier`, `/mutations`, `/deployer` (`.claude/skills/`).

## Règles (chacune née d'un défaut réel)
- **Rien n'est poussé ni déployé sans l'accord explicite de Cyprien.** `vercel deploy` téléverse le DISQUE, pas ce
  que git suit : jamais depuis un arbre modifié, jamais depuis le dépôt principal quand une autre session y travaille.
- **Aucune écriture dans la base de production sans accord explicite.** Un changement de schéma = du SQL donné à
  Cyprien, qui l'exécute dans l'éditeur Supabase (il n'existe aucune RPC `exec_sql`). En local, le serveur MCP
  `supabase-lecture` est en lecture seule.
- **Quand la donnée manque, on le dit, on ne la fabrique pas** : jamais de valeur par défaut affichée comme une mesure.
- Supabase ne lève pas d'exception, il RETOURNE `{ error }` : toute écriture lit son `error` (un `try/catch` seul ne
  rattrape rien).
- Passager ou refus : `estErreurTransitoire(erreur, statut)` (`src/lib/cron/transitoire.ts`), avec l'erreur et le
  statut HTTP de la réponse, jamais `error.message` seul.
- Tests maison : un test ajouté va AVANT le bloc de résumé (après, il ne fait rien échouer) ; une assertion n'est
  acquise que si une mutation la fait rougir, **code de sortie 1** compris ; un test qui lit le source retire les
  commentaires sans couper `://` et vise le site d'appel, pas l'import.
- Plusieurs sessions travaillent en parallèle dans `.claude/worktrees/` : ne jamais écrire dans le worktree d'une
  autre session.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Le projet

**Pacevo** (ex « Running & Trail Empire » : l'ancien nom subsiste dans `package.json`, `capacitor.config.ts`, `DEPLOYMENT.md`), coach de course à pied et de trail, en ligne sur https://pacevo.fr. Projet de Cyprien. Répondre en **français** ; code, commentaires, commits et interface sont en français.

Pile : Next.js 16 (App Router, React 19, Turbopack), TypeScript, Tailwind 3 ; Supabase (Postgres servi par PostgREST, Auth, RLS) ; Vercel en offre **Hobby** ; e-mails Resend ; IA Gemini ; montres via intervals.icu. `DEPLOYMENT.md` est périmé (OpenAI, Railway, anciens tarifs) : ne pas s'y fier.

## Règles (chacune née d'un défaut réel)

- **Rien n'est poussé ni déployé sans l'accord explicite de Cyprien.** `vercel deploy` téléverse le DISQUE, pas ce que git suit : jamais depuis un arbre modifié, jamais depuis le dépôt principal quand une autre session y travaille. Procédure : compétence `/deployer`.
- **Aucune écriture dans la base de production sans accord explicite.** Un changement de schéma = du SQL donné à Cyprien, qui l'exécute dans l'éditeur Supabase (il n'existe aucune RPC `exec_sql`). Le connecteur Supabase de claude.ai a TOUS les droits (rôle `postgres`) : sur le Mac de Cyprien, le garde-fou `~/.claude/hooks/garde-supabase.mjs` bloque ses outils d'écriture et force chaque `execute_sql` en transaction READ ONLY. Ailleurs (routine cloud), aucun filet : la règle seule protège.
- **Quand la donnée manque, on le dit, on ne la fabrique pas** : jamais de valeur par défaut affichée comme une mesure (pas de VMA ni de FC max codées en dur, pas de chiffre plausible inventé).
- Supabase ne lève pas d'exception, il RETOURNE `{ error }` : toute écriture lit son `error` (un `try/catch` seul ne rattrape rien). Les échecs serveur vont dans `error_logs`.
- Passager ou refus : `estErreurTransitoire(erreur, statut)` (`src/lib/cron/transitoire.ts`), avec l'erreur et le statut HTTP de la réponse, jamais `error.message` seul.
- Plusieurs sessions travaillent en parallèle dans `.claude/worktrees/` : ne jamais écrire dans le worktree d'une autre session.

## Commandes

```bash
npm run dev                        # serveur de dev, port 3000 (Turbopack ; `dev:webpack` en repli)
npm run verify                     # tsc --noEmit + toute la suite : au vert avant tout commit et tout déploiement
npx tsx tests/<nom>.test.ts        # un seul fichier de test
npx tsc --noEmit                   # typage seul
npm run enligne                    # compare le commit servi (pacevo.fr/version.json) à HEAD ; code 1 si la prod est en retard
npm run deploie                    # verify → build → vercel deploy --prod (avec l'accord de Cyprien, voir /deployer)
npm run db:types                   # régénère src/types/supabase.ts
```

`npm run lint` n'est pas utilisé (aucune configuration ESLint). Procédures détaillées : compétences `/verifier`, `/mutations`, `/deployer` (`.claude/skills/`).

## Tests

- Aucun framework : chaque `tests/*.test.ts` est un script autonome (`node:assert` + compteur maison) lancé par `tsx`. `npm test` les enchaîne par `&&` : un fichier qui plante saute tous les suivants. **Un nouveau fichier de test s'ajoute à la chaîne `test` de `package.json`**, sinon il ne tourne jamais.
- Un test ajouté va AVANT le bloc de résumé (après, il affiche son ✗ sans rien faire échouer). Une assertion n'est acquise que si une mutation la fait rougir, **code de sortie 1** compris.
- Beaucoup de tests lisent le **code source** pour imposer des invariants (garde sur chaque route admin, `stripProfileSecrets`, toute clé i18n appelée existe, aucun secret dans le bundle client…). Ils retirent les commentaires sans couper `://`, et visent le site d'appel, pas l'import.
- **Un test à date figée passe son jour à la fonction fenêtrée** (`computeHrZones`, `computeForme`…) : sinon il rougit seul quand le calendrier avance.
- Chaque test fige un défaut réellement constaté. Avant de « corriger » un test rouge, vérifier d'abord s'il a raison.

## Architecture

**Routes** (`src/app/`) : pages publiques indexées (accueil, `/courses`, `/chaussures`, `/blog`, pages légales), `(auth)`, `onboarding`, l'application `dashboard/*`, `admin`, et `api/*`.

**Authentification** : il n'y a pas de middleware (`src/lib/supabase/middleware.ts` n'est appelé nulle part). La porte est côté serveur dans `src/app/dashboard/layout.tsx` : utilisateur → `/login`, accord santé enregistré → `/consentement`, profil incomplet → `/onboarding`. Chaque route d'API se protège elle-même ; les routes admin passent par `denyIfNotAdmin` (`src/lib/api/adminGuard.ts`) ou `estAdmin` (`src/lib/admin/acces.ts`, piloté par `ADMIN_EMAILS`).

**Clients Supabase** (`src/lib/supabase/`) : `server.ts` (cookies de session, RLS appliquée), `client.ts` (navigateur), `admin.ts` (service role, contourne la RLS, serveur uniquement). `profiles` contient `intervals_api_key` : tout profil envoyé au client passe par `stripProfileSecrets` (`src/lib/profile/safe.ts`).

**Données de montre** : tout passe par intervals.icu. Un athlète s'y relie par une clé API collée, ou par l'autorisation OAuth (application intervals.icu n° 1331, `src/lib/intervals/oauth.ts`, routes `/api/intervals/oauth/*`). Les deux vivent dans `intervals_api_key` (jeton préfixé `oauth:`) et l'en-tête d'accès ne se construit QUE par `enteteIntervals` (`src/lib/intervals/auth.ts`). Identifiants : `identifiantsDe` (`src/lib/intervals/identifiants.ts`), jamais de repli sur `process.env.INTERVALS_ICU_*`. `src/lib/intervals/syncAndCoach.ts` est la chaîne unique : synchro → analyses → traces GPS → replanification → envoi à la montre (replanification au plus toutes les 10 min). Trois déclencheurs : `AutoSync` (navigateur, au chargement puis toutes les 2 min), GitHub Actions `sync-coach.yml` → `/api/cron/sync-all`, cron Vercel nocturne `/api/cron/auto-coach`.

**Coach** : `buildWeekPlan` (`src/lib/ai/autoPlan.ts`) construit un plan glissant de 7 jours de façon **déterministe, sans LLM**. Ses entrées viennent de `buildAthleteContext` (`src/lib/ai/coachContext.ts`), ses règles de `src/lib/coach/*`. Le LLM (Gemini via `src/lib/ai/gemini.ts` : réessais et bascule de modèle, quota gratuit compté par projet) ne sert qu'aux fonctions qui « parlent » : analyse de séance, kiné, assistant de support, relecture Premium. Une route qui attend du JSON demande le mode JSON (`responseMimeType`).

**Le texte du plan est canonique en français** : `src/lib/watch/intervals.ts` analyse la prose française (« corps : », « récup », « N×DISTANCE à ALLURE ») pour construire les séances envoyées à la montre. Les autres langues sont produites au moment de la construction du plan (`src/lib/i18n/multi.ts`, `tr()`), pour l'affichage seulement.

**Sources uniques** : accès et essai (`src/lib/billing/access.ts`, l'essai se déduit de `profiles.created_at`), prix affichés (`src/lib/billing/prix.ts`), chiffres publics (`src/lib/brand/stats.ts`), identité légale (`src/lib/brand/editeur.ts`), VMA (`effectiveVma()` dans `src/lib/running/fitness.ts`), date et fuseau (`src/lib/time/`).

**i18n** : 5 langues actives (fr, en, de, es, pt) et trois mécanismes : le dictionnaire `T` + `useT()` (`src/lib/i18n/translations.ts`), des tables `*I18n.ts` par domaine, et des `Record<Lang, …>` déclarés directement dans les composants. `tests/i18n.test.ts` impose la couverture. next-intl est branché dans `src/i18n/` mais l'interface ne l'utilise pas.

**Temps** : les fonctions serveur ne tournent pas dans le fuseau des coureurs. Le fuseau du navigateur arrive par le cookie `pacevo_tz` puis `FuseauProvider`. Toute date rendue côté serveur passe par `src/lib/time/`, sinon on obtient des erreurs React #418 la nuit.

**Automatisation** : Vercel Hobby limite un cron à une fois par jour (`vercel.json`). Les tâches fréquentes sont dans `.github/workflows/*.yml` et appellent `/api/cron/*` avec `CRON_SECRET`. Leur suivi est dans /admin → Automatisation (`src/lib/cron/supervision.ts`). Les scripts d'écriture sans surveillance s'arrêtent au-delà d'un seuil de changements (`scripts/garde-fous.ts`).

**Données lourdes** : `data/` (≈ 37 Mo de JSON de collecte) est exclu de la fonction serveur dans `next.config.ts` ; seul `parcours_certifies.min.json.gz` est embarqué. Le catalogue des courses vit dans la table `races`. `mobile/` est une app Expo séparée, exclue de `tsconfig.json`.

## Pièges à connaître

- **Schéma appliqué à la main** : un fichier `supabase/migrations/NNN_*.sql` ne prouve pas que la table existe. Écrire les colonnes récentes dans un `update()` séparé : PostgREST rejette tout l'update si une seule colonne manque.
- **RLS** : une table avec RLS mais sans politique refuse en silence les écritures de son propriétaire. Une politique ne peut pas joindre `profiles` (passer par une fonction `security definer`).
- Un composant `"use client"` embarque tout son arbre d'imports dans le bundle. Garder hors de cet arbre les modules serveur (secrets, grosses tables) ; `tests/bundle.test.ts` le vérifie.
- Les opacités Tailwind hors échelle (`/44`, `/12`) ne génèrent aucun CSS, sans erreur. Next 16 ramène à 75 toute `quality` d'image non déclarée dans `images.qualities` (`next.config.ts`).
- **`git push` ne déploie rien**, et un fichier non suivi dans `public/` part quand même en production. Ne pas modifier de fichiers pendant que `npm run deploie` tourne ; contrôler ensuite avec `npm run enligne`. Une variable d'environnement Vercel ne s'applique qu'au déploiement SUIVANT.
- Le dépôt est sur le Bureau synchronisé par iCloud, qui crée des doublons `* 2.*` (dont `.next 2/`). `npm run deploie` les supprime et `.gitignore` couvre `/.next*`.
- Si `git push` échoue avec « unexpected disconnect », lancer `git count-objects -v` ; si `packs: 0`, faire `git repack -a -d --window=10 --depth=10`.
- Un serveur de dev tourne souvent déjà sur le port 3000, et Next refuse un second `next dev` dans le même dossier. Les pages du tableau de bord exigent une session : un `curl` y répond 307.
- Dans un worktree (`.claude/worktrees/`), créer un lien symbolique vers le `node_modules` du dépôt principal et recréer `next-env.d.ts`, sinon `tsc` échoue sur les imports d'images (compétence `/verifier`). ⚠️ Jamais de `npm ci` / `npm install` tant que `node_modules` est ce lien : npm vide le dossier en suivant le lien, donc celui du dépôt principal. Retirer d'abord le lien (`rm node_modules`, sans barre finale).
- Un `next dev` d'une AUTRE session peut occuper le port 3000 : les tests HTTP de `tests/amis.crash.test.ts` vérifient désormais que le serveur tourne depuis le dossier testé (sinon ils sont ignorés, et le disent).

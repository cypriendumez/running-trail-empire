# État de l'équipe d'agents Pacevo

*Tenu par `@Nexus`. Mis à jour le 08/11/2026. Chaque ligne dit ce qui TOURNE VRAIMENT, pas ce
qui est prévu : un agent écrit dans la constitution mais sans routine planifiée n'existe pas.*

> ⚠️ **Dépôt PUBLIC** (`cypriendumez/running-trail-empire`). Rien de personnel ni de comptable
> ici : mails, factures, papiers administratifs, briefings et partenariats vivent UNIQUEMENT dans
> `~/Desktop/Pacevo/` (hors git). `.gitignore` bloque ces dossiers sous `ops/` par sécurité.

## Ce qui tourne réellement (routines cloud claude.ai, vérifié par l'API le 08/11/2026)

| Routine | Rôle dans la constitution | Cadence | Modèle | État |
|---|---|---|---|---|
| `trig_01UxynUoioWYvRWGBKeppWcf` « Bugs Pacevo — correction continue » | **`@Sweeper`** (n°8) | toutes les 3 h, 8 h–23 h Paris | Sonnet 5.5 | EXÉCUTÉ (dernier passage RAS le 07/11) |
| `trig_01UQK2i4sGE7ExL46Qw9tx6k` « Blog Pacevo — un article sourcé » | **`@Plume`** (n°21) | 1er et 15 à 9 h | Opus 5 | EXÉCUTÉ, mais bloqué en aval par la PR #3 |
| `trig_01LMfDodu3wcH4XqPPUCQdtq` « Blog Pacevo — sujets hebdomadaires » | `@Plume` (carnet de sujets) | lundi 8 h | Sonnet 5 | EXÉCUTÉ |
| `trig_01G7sHJiyxJcszNf8xtnkky1` « Coach Pacevo » (créée le 08/11) | **`@Sparring`** + **`@SafeRun`** | lundi 10 h | Opus 5.5 | 1er passage le 09/11 |
| `trig_01LzKBr2sYrc4Ngoir4447ou` « Direction Pacevo » (créée le 08/11) | **`@Nexus`** + **`@PostMortem`** + **`@Greffier`** | vendredi 10 h | Sonnet 5.5 | 1er passage le 13/11 |
| `trig_01LRqMYRzrPpv4zgS1dcMik4` « Sécurité et veille Pacevo » (créée le 08/11) | **`@Bunker`** + **`@Vault`** + **`@TimeMachine`** + **`@Radar`** | le 5 du mois, 10 h | Sonnet 5.5, connecteur Supabase (lecture seule par consigne) | 1er passage le 05/12 |

⚠️ Le passage « Bugs » du 08/11 à 10 h a échoué sur la limite d'usage (`USAGE_LIMIT_REACHED`) : le quota était déjà épuisé avant l'ajout de ces trois routines.

Tâches GitHub Actions existantes (suivies dans /admin › Automatisation) : synchro du coach,
sauvegarde hebdomadaire des tables publiques (`races`, `product_offers`, dimanche 03 h 20),
newsletter, veille des courses. Ce sont des tâches, pas des agents : elles ne raisonnent pas.

## Vague 1 : les 12 agents « actifs »

| # | Agent | État réel | Cause / ce qu'il faut |
|---|---|---|---|
| 1 | `@Nexus` | PLANIFIÉ | Routine « Direction », vendredi 10 h. En session : « `@Nexus point` » lit ce fichier. |
| 3 | `@Sparring` | PLANIFIÉ (Coach, lundi) | 6 des 10 archétypes déjà testés (`tests/profils.crash.test.ts`) ; 4 profils manquent, voir `ops/sparring/PROFILS.md`. |
| 7 | `@SafeRun` | PLANIFIÉ (Coach, lundi) | Rejoue les tests Kiné, douleurs et Santé après `@Sparring`. |
| 8 | `@Sweeper` | **EXÉCUTÉ** | = routine « Bugs Pacevo ». Filtre `localhost` déjà en place à la source (voir plus bas). |
| 9 | `@Bunker` | PLANIFIÉ (Sécurité et veille, le 5) | PR seulement, jamais de fusion ni de version majeure. |
| 10 | `@Vault` | PLANIFIÉ (Sécurité et veille, le 5) | Lecture seule ; une faille non corrigée ne va JAMAIS dans le dépôt public, seulement dans le compte-rendu privé de la routine, avec le SQL pour Cyprien. |
| 21 | `@Plume` | **BLOQUÉ** | Cause exacte : PR #3 « Reprendre après une blessure » OUVERTE depuis le 01/10/2026, fusionnable, en attente de relecture. Action requise : Cyprien relit et fusionne ou ferme la PR #3. |
| 26 | `@Radar` | PLANIFIÉ (Sécurité et veille, le 5) | Risque BLOQUÉ : le réseau cloud refuse probablement les sites concurrents. |
| 34 | `@Greffier` | PLANIFIÉ (Direction, vendredi) | Check-list montres : `ops/greffier/API-MONTRES.md`. |
| 48 | `@TimeMachine` | PLANIFIÉ (contrôle mensuel) + **BLOQUÉ (en partie)** | Les tables publiques sont sauvegardées chaque semaine. Cause exacte : les données PERSONNELLES (profils, séances, journal) ne sont sauvegardées nulle part, et le test de restauration « sur base isolée » exige un second projet Supabase. Action requise : décision de Cyprien (plan Supabase Pro avec PITR, ou destination privée). |
| 61 | `@Concierge` | **BLOQUÉ** | Cause exacte : aucun connecteur de messagerie (Gmail ou autre) n'est branché à Claude ; la boîte `contact@pacevo.fr` n'est pas lisible. Action requise : brancher un connecteur Gmail/IMAP dans claude.ai › Connecteurs, puis dire « Concierge branché ». |
| 64 | `@PostMortem` | **EXÉCUTÉ**, puis PLANIFIÉ (Direction, vendredi) | Fichier `ops/memory/LESSONS_LEARNED.md` créé et amorcé avec les leçons réelles du projet. |

## Unités en Vague 2 (24) et en attente (22)

Définies dans `ops/CONSTITUTION.md`, aucune routine. Elles passent à l'état ACTIF quand Cyprien
annonce leur déclencheur ; `@Nexus` met alors cette page à jour et crée la routine.

## À RATTRAPER

- Aucune.

## BLOQUÉES (cause + correctif prêt)

1. **`@Plume`** : PR #3 en attente depuis 38 jours. Correctif : la relire (https://github.com/cypriendumez/running-trail-empire/pull/3).
2. **`@Concierge`** : aucun connecteur mail. Correctif : connecteur Gmail/IMAP.
3. **`@TimeMachine`** : données personnelles sans sauvegarde. Correctif : décision PITR ou destination privée.
4. **Réseau des routines** : l'environnement cloud « Default » refuse `pacevo.fr` (constaté le 07/11, proxy `connect_rejected`). Correctif : dans claude.ai, menu « Local » sous la zone de saisie → Cloud → ⚙️ sur Default → accès réseau personnalisé → ajouter `pacevo.fr` et `pacevo.app`. Non modifiable par l'API des routines.
5. **`ops/` absent de `main`** : les routines clonent GitHub ; tant que `ops/` n'est pas commité et poussé, « Direction » s'arrête en BLOQUÉ et les autres travaillent sans ce dossier. Correctif : commit + push (accord de Cyprien).
6. **Quota** : les routines partagent le quota HEBDOMADAIRE de Cyprien avec ses sessions. Les passages blog du 15/10, 01/11 et 02/11 ont échoué en 1 à 15 s sur « weekly limit ». D'où le regroupement en 3 routines hebdo/mensuelles (`ops/CONSTITUTION.md`, § Corrections) plutôt que 12 agents dont 3 quotidiens.

## Contrôles faits le 08/11/2026 (preuves)

- `error_logs` : dernière ligne `localhost` le 06/11 à 12:09 UTC, **zéro ligne d'aucune sorte depuis le filtre** (06/11 16:54). Le filtre `rapportLocal` (`src/lib/csp/rapport.ts`) est appliqué à l'entrée de `/api/log-error` et `/api/csp-report` ; `estBruitDeDev` (`src/lib/admin/bugs.ts`) masque l'historique dans /admin. Rien à corriger.
- Production : `npm run enligne` → `b4b3875`, identique à `main`.
- `pacevo.app` résout vers Vercel (76.76.21.21).

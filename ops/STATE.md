# État de l'équipe d'agents Pacevo

*Tenu par `@Nexus`. Mis à jour le 09/11/2026 au matin. Chaque ligne dit ce qui TOURNE VRAIMENT,
pas ce qui est prévu : un agent écrit dans la constitution mais sans routine planifiée n'existe pas.*

> ⚠️ **Dépôt PUBLIC** (`cypriendumez/running-trail-empire`). Rien de personnel, de comptable ni
> de sécurité non corrigée ici : mails, factures, papiers, briefings et sauvegardes vivent
> UNIQUEMENT dans `~/Desktop/Pacevo/` (hors git). `.gitignore` bloque ces dossiers sous `ops/`.

## Calendrier

- **Lancement payant : avril 2027.** Début d'activité de la micro-entreprise le 1er avril 2027
  (dépôt au guichet à partir du 1er mars 2027), pour une ACRE de 12 mois pleins. Rappels
  administratifs planifiés sur le Mac de Cyprien (22/02, 01/03, 22/03, 15/04/2027, URSSAF trimestriel).
- Le SIREN (exigé par Garmin et Suunto) arrivera donc en mars 2027.

## Ce qui tourne réellement

**Routines cloud (claude.ai), toutes la NUIT** : elles partagent la limite d'usage des 5 heures
avec les sessions de Cyprien ; en journée, 8 passages sur 10 étaient refusés (07-08/11/2026).

| Routine | Agents | Quand (heure de Paris) | Modèle |
|---|---|---|---|
| Bugs Pacevo | `@Sweeper` | tous les jours, 6 h et 23 h | Sonnet 5.5 |
| Blog Pacevo, un article sourcé | `@Plume` | le 1er et le 15, 3 h | Opus 5 |
| Blog Pacevo, sujets | `@Plume` | lundi 3 h 30 | Sonnet 5 |
| Coach Pacevo | `@Sparring`, `@SafeRun` | lundi 5 h | Opus 5.5 |
| Direction Pacevo | `@Nexus`, `@PostMortem`, `@Greffier` | vendredi 6 h | Sonnet 5.5 |
| Sécurité et veille Pacevo | `@Bunker`, `@Vault`, `@Radar` (+ contrôle de la sauvegarde publique) | le 5 du mois, 4 h | Sonnet 5.5 |

**Tâches locales (Mac de Cyprien, app Claude)** : elles écrivent dans `~/Desktop/Pacevo/`, ce
qu'une routine cloud ne peut pas faire.

| Tâche | Agent | Quand |
|---|---|---|
| Courrier du matin | `@Concierge` | tous les jours, 8 h |
| Sauvegarde chiffrée de la base | `@TimeMachine` | dimanche 11 h |

**Tâches GitHub Actions** (suivies dans /admin › Automatisation) : synchro du coach, sauvegarde
hebdomadaire des tables publiques (dimanche 03 h 20), newsletter, veille des courses.

## Vague 1 : 12 agents sur 12 en place

| # | Agent | État | Preuve / remarque |
|---|---|---|---|
| 1 | `@Nexus` | PLANIFIÉ | Direction, 1er passage le 13/11. |
| 3 | `@Sparring` | **EXÉCUTÉ** | 09/11 (5 h) : profil marathonien sub-3 h ajouté ; 2 défauts du plan trouvés (« /km/km », seuil 3 jours après un marathon), PR #4 fusionnée et en ligne (1e2173c). 3 profils de la matrice manquent encore (`ops/sparring/PROFILS.md`). |
| 7 | `@SafeRun` | PLANIFIÉ | Coach, lundi. |
| 8 | `@Sweeper` | **EXÉCUTÉ** | 08/11 : pacevo.fr joignable depuis le cloud (version lue), aucun défaut sur 24 h. Filtre `localhost` en place à la source depuis le 06/11. |
| 9 | `@Bunker` | **EXÉCUTÉ** | 08/11 : 23 → 9 failles de dépendances, Next.js 16.4.5, déployé. Restent `zod` (importé nulle part) et la chaîne ESLint (non utilisée). |
| 10 | `@Vault` | PLANIFIÉ | Sécurité, le 5/12. Lecture seule ; une faille non corrigée ne va jamais dans le dépôt. |
| 21 | `@Plume` | **EXÉCUTÉ** | PR #3 « Reprendre après une blessure » fusionnée et en ligne le 08/11. Prochain article le 15/11. |
| 26 | `@Radar` | PLANIFIÉ | Sécurité et veille, le 5/12. Sites des concurrents autorisés dans le réseau cloud. |
| 34 | `@Greffier` | PLANIFIÉ | Direction, vendredi. Check-list : `ops/greffier/API-MONTRES.md`. |
| 48 | `@TimeMachine` | **EXÉCUTÉ** | 08/11 : 1re sauvegarde chiffrée complète de la base, relue et recomptée. Tâche locale chaque dimanche. |
| 61 | `@Concierge` | PLANIFIÉ | Boîte Gmail dédiée branchée ; `contact@` et `support@` y sont redirigés (prouvé, Outlook compris le 09/11). Filtre « jamais en spam » sur ces deux adresses ; le connecteur ne voit pas le Spam. 1er passage le 09/11 à 8 h. |
| 64 | `@PostMortem` | **EXÉCUTÉ** | `ops/memory/LESSONS_LEARNED.md` tenu ; passage hebdo dans Direction. |

## Unités en Vague 2 (24) et en attente (22)

Définies dans `ops/CONSTITUTION.md`, aucune routine. La Vague 2 sera ajoutée aux routines
existantes avant le lancement (avril 2027), pas en routines séparées, pour ménager la limite
d'usage. Les 6 fonctions « APP » sont à auditer : certaines existent déjà en partie.

## À RATTRAPER

- Aucune.

## BLOQUÉES ou en cours

1. **Sauvegarde des données personnelles** : couverte chaque semaine sur le Mac (chiffrée), mais
   pas de copie quotidienne côté hébergeur tant que Supabase est sur l'offre gratuite. Passage à
   l'offre Pro à décider au lancement.
2. **Chantier sécurité du 08/11** (mots de passe, CSP appliquée, CAPTCHA en sommeil, double
   authentification facultative) : déployé le 08/11 au soir ; migration 041 exécutée et réglages
   Supabase faits par Cyprien le 09/11 vers 0 h 25 ; double authentification active sur son compte.
   Reste, plus tard, l'activation du CAPTCHA (liste hors dépôt :
   `~/Desktop/Pacevo/securite-2026-11-08-actions.md`). Aucun agent ne change ces réglages à sa place.

## Résolues le 09/11/2026

- Mails d'Outlook « perdus » vers Gmail : ils étaient tous dans le Spam de Gmail, invisible au connecteur. Sortis du spam, filtre posé ; `@Concierge` prévenu de cet angle mort.
- PR #4 du Coach relue, vérifiée sur le Mac, fusionnée et déployée.

## Résolues le 08/11/2026

- `@Plume` débloqué (PR #3 relue, corrigée, fusionnée, déployée).
- Réseau des routines : 22 domaines autorisés (pacevo.fr et pacevo.app compris), prouvé.
- `@Concierge` : connecteur Gmail branché, redirections OVH prouvées, `COACH_EMAIL` = `contact@pacevo.fr` en production.
- Données personnelles : sauvegarde chiffrée en place.
- Limite d'usage : routines déplacées la nuit.

# État de l'équipe d'agents Pacevo

*Tenu par `@Nexus`. Mis à jour le 09/11/2026 à 11 h 30. Chaque ligne dit ce qui TOURNE VRAIMENT,
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
| Bugs Pacevo | `@Sweeper` (+ visa `@Architect` depuis le 09/11, à prouver) | tous les jours, 6 h et 23 h | Sonnet 5.5 |
| Blog Pacevo, un article sourcé | `@Plume` (+ visa `@Mercator` depuis le 09/11, à prouver) | le 1er et le 15, 3 h | Opus 5 |
| Blog Pacevo, sujets | `@Plume` (+ visa `@Mercator` depuis le 09/11, à prouver) | lundi 3 h 30 | Sonnet 5 |
| Coach Pacevo | `@Sparring`, `@SafeRun` (+ visa `@HeadCoach` depuis le 09/11, à prouver) | lundi 5 h | Opus 5.5 |
| Direction Pacevo | `@Nexus`, `@PostMortem`, `@Greffier` (+ `@Strategos`, `@Trésorier`, `@Atlas` depuis le 09/11, à prouver) | vendredi 6 h | Sonnet 5.5 |
| Sécurité et veille Pacevo | `@Bunker`, `@Vault`, `@Radar` (+ contrôle de la sauvegarde publique ; + visas `@Architect` et `@Mercator` depuis le 09/11, à prouver) | le 5 du mois, 4 h | Sonnet 5.5 |

**Tâches locales (Mac de Cyprien, app Claude)** : elles écrivent dans `~/Desktop/Pacevo/`, ce
qu'une routine cloud ne peut pas faire.

| Tâche | Agent | Quand |
|---|---|---|
| Courrier du matin | `@Concierge` (+ visa `@Chancelier` depuis le 09/11, à prouver) | tous les jours, 8 h |
| Sauvegarde chiffrée de la base | `@TimeMachine` | dimanche 11 h |

**Tâches GitHub Actions** (suivies dans /admin › Automatisation) : synchro du coach, sauvegarde
hebdomadaire des tables publiques (dimanche 03 h 20), newsletter, veille des courses.
`@Vigie` (`vigie.yml`) sonde pacevo.fr : demandé toutes les 30 min, mais GitHub ne lance les
planifications de ce dépôt que toutes les 3 à 4 heures (mesuré le 09/11 : 2 passages planifiés en
15 h, comme `sync-coach`). Ce trou est comblé depuis le 09/11 par **UptimeRobot** (offre gratuite,
compte de Cyprien, alertes par mail sur son Outlook) : deux sondes toutes les 5 min, l'accueil
https://pacevo.fr (HTTP 200) et https://pacevo.fr/version.json (alerte si « commit » disparaît).

## Vague 1 : 12 agents sur 12 en place

| # | Agent | État | Preuve / remarque |
|---|---|---|---|
| 1 | `@Nexus` | PLANIFIÉ | Direction, 1er passage le 13/11. |
| 3 | `@Sparring` | **EXÉCUTÉ** | 09/11 (5 h) : profil marathonien sub-3 h ajouté ; 2 défauts du plan trouvés (« /km/km », seuil 3 jours après un marathon), PR #4 fusionnée et en ligne (1e2173c). 3 profils de la matrice manquent encore (`ops/sparring/PROFILS.md`). |
| 7 | `@SafeRun` | PLANIFIÉ | Coach, lundi. |
| 8 | `@Sweeper` | **EXÉCUTÉ** | 08/11 : pacevo.fr joignable depuis le cloud (version lue), aucun défaut sur 24 h. Filtre `localhost` en place à la source depuis le 06/11. |
| 9 | `@Bunker` | **EXÉCUTÉ** | 08/11 : 23 → 9 failles de dépendances, Next.js 16.4.5, déployé. Restent `zod` (importé nulle part) et la chaîne ESLint (non utilisée). |
| 10 | `@Vault` | PLANIFIÉ | Sécurité, le 5/12. Lecture seule ; une faille non corrigée ne va jamais dans le dépôt. |
| 21 | `@Plume` | **EXÉCUTÉ** | 09/11 : PR #6 « Courir dans le froid et la nuit » (p16) fusionnée et en ligne (e738e78). Elle vient de la relance MANUELLE du 07/11, arrêtée par la limite d'usage puis finie le 09/11 : trois tours de double relecture rendus ÉCHOUE, deux imprécisions corrigées à la relecture finale. Lancée avant le texte du 09/11, elle ne prouve pas le visa `@Mercator`. Prochain article le 15/11 à 3 h (cron `0 3 1,15 * *`, heure de Paris). |
| 26 | `@Radar` | PLANIFIÉ | Sécurité et veille, le 5/12. Sites des concurrents autorisés dans le réseau cloud. |
| 34 | `@Greffier` | PLANIFIÉ | Direction, vendredi. Check-list : `ops/greffier/API-MONTRES.md`. |
| 48 | `@TimeMachine` | **EXÉCUTÉ** | 08/11 : 1re sauvegarde chiffrée complète de la base, relue et recomptée. Tâche locale chaque dimanche. |
| 61 | `@Concierge` | **EXÉCUTÉ** | 09/11 (8 h 05, 1er passage) : 9 fils classés, 1 brouillon propre (trou « à compléter » au lieu d'inventer), 0 envoi, briefing et liste des fils traités écrits dans `~/Desktop/Pacevo/`. Filtre « jamais en spam » sur contact@ et support@ ; le connecteur ne voit pas le Spam. |
| 64 | `@PostMortem` | **EXÉCUTÉ** | `ops/memory/LESSONS_LEARNED.md` tenu ; passage hebdo dans Direction. |

## Direction (créée le 09/11/2026) : 11 unités définies, 7 branchées dans les routines, premiers passages à prouver

Organigramme, rattachements et statuts : `ops/direction/README.md` (source unique, gardée par
`tests/organigramme.test.ts`) ; fiches : `.claude/agents/` (sous-agents en lecture seule, modèle `opus`) ; textes à
ajouter aux routines : `ops/direction/routines/`. Chaîne : agent → directeur de pôle → `@Atlas` → `@Nexus` → Cyprien.
Aucune routine ni quota en plus : un directeur relit dans le passage de son agent, seulement s'il y a une PR ou un
rapport. Statut honnête : « DÉFINI » tant qu'aucune routine n'appelle le sous-agent ; « ACTIF (dans …) » après un
premier passage prouvé (`list_runs`, `get_run_log`). Les textes de `ops/direction/routines/` ont été appliqués le 09/11/2026 vers 10 h avec le GO de Cyprien :
six routines cloud (Direction et Blog sujets ont reçu l'outil Agent, qui leur manquait) et la tâche locale
Courrier. Premiers passages à lire dans le journal : Bugs le 09/11 à 23 h, Courrier le 10/11 à 8 h, Direction le
13/11 à 6 h, Blog article le 15/11 à 3 h, Coach et Blog sujets le 16/11, Sécurité et veille le 05/12.

| # | Agent | Rôle | État | Routine (premier passage à prouver) |
|---|---|---|---|---|
| 1 | `@Nexus` | directeur général délégué, bras droit | ACTIF | déjà dans Direction ; devient aussi le sous-agent `nexus` |
| 71 | `@Atlas` | directeur adjoint des opérations, bras gauche | DÉFINI, branché le 09/11 | Direction (vendredi), juste avant `@Nexus` |
| 72 | `@Strategos` | pôle A, stratégie et qualité des agents | DÉFINI, branché le 09/11 | Direction, avec les leçons de la semaine |
| 73 | `@Chancelier` | pôle B, secrétaire général | DÉFINI, branché le 09/11 | Courrier (Mac, 8 h), après `@Concierge` |
| 74 | `@HeadCoach` | pôle C, directeur scientifique | DÉFINI, branché le 09/11 | Coach (lundi 5 h), avant la PR |
| 75 | `@Architect` | pôle D, technique et sécurité | DÉFINI, branché le 09/11 | Bugs (6 h, 23 h) et Sécurité et veille (le 5) |
| 76 | `@Maestro` | pôle E, produit et design | DÉFINI | avec son pôle (Vague 2) ; à la demande sur toute PR d'interface |
| 77 | `@Mercator` | pôle F, marketing | DÉFINI, branché le 09/11 | Blog (1er/15, lundi) et Sécurité et veille (rapport de `@Radar`) |
| 78 | `@Alliance` | pôle G, commercial et partenariats | DÉFINI | avec son pôle (en attente) ; à la demande |
| 79 | `@Trésorier` | pôle H, finance et juridique | DÉFINI, branché le 09/11 | Direction, avec les dossiers de `@Greffier` |
| 80 | `@Oracle` | pôle I, données | DÉFINI | avec son pôle (en attente) ; à la demande |
| 81 | `@Conductor` | pôle J, fonctions de l'application | DÉFINI | avec la Vague 2 (audit des 6 fonctions) ; à la demande |

## Unités en Vague 2 (22) et en attente (24)

Décompte fait sur le tableau de la constitution le 09/11/2026 (son introduction inverse les deux chiffres) :
12 actifs + 11 de direction (définis, voir ci-dessus) + 22 en Vague 2 + 24 en attente + 6 fonctions de
l'application + 6 numéros fusionnés = 81 numéros, sans trou, + `@Vigie`.
Organigramme dans le dépôt : `ops/direction/README.md`. En PDF (hors dépôt) :
`~/Desktop/Pacevo/structure de l'entreprise/organigramme-agents-pacevo.pdf`, régénéré par
`organigramme-agents-pacevo.py` dans le même dossier.

Définies dans `ops/CONSTITUTION.md`, aucune routine. La Vague 2 sera ajoutée aux routines
existantes avant le lancement (avril 2027), pas en routines séparées, pour ménager la limite
d'usage. Les 6 fonctions « APP » sont à auditer : certaines existent déjà en partie.

## À RATTRAPER

- Aucune.

## BLOQUÉES ou en cours

1. **Sauvegarde des données personnelles** : couverte chaque semaine sur le Mac (chiffrée), mais
   pas de copie quotidienne côté hébergeur tant que Supabase est sur l'offre gratuite. Passage à
   l'offre Pro à décider au lancement.

## Résolues le 09/11/2026

- **Chantier sécurité du 08/11 terminé** (mots de passe, CSP appliquée, double authentification
  facultative, CAPTCHA). Migration 041 et réglages Supabase faits par Cyprien vers 0 h 25 ; double
  authentification active sur son compte. **CAPTCHA Cloudflare Turnstile actif partout depuis 8 h 15** :
  inscription, mot de passe oublié, changement de mot de passe (nos routes) et connexion par mot de
  passe (Supabase → Attack Protection). Widget « Pacevo » dans le compte Cloudflare de Cyprien (hôtes
  `pacevo.fr` et `localhost`), clés dans Vercel en Production. Essai réel réussi dans Chrome. Aucun
  agent ne change ces réglages à sa place. ⚠️ Un navigateur piloté (navigateur intégré de Claude,
  routines) échoue au CAPTCHA : pour voir une page authentifiée, lien `magiclink` fabriqué avec la clé
  d'administration, jamais le formulaire de connexion.
- Mails d'Outlook « perdus » vers Gmail : ils étaient tous dans le Spam de Gmail, invisible au connecteur. Sortis du spam, filtre posé ; `@Concierge` prévenu de cet angle mort.
- PR #4 du Coach relue, vérifiée sur le Mac, fusionnée et déployée.
- **Trois articles de blog en ligne le même jour**, sans que `@Plume` ait tourné plus souvent que prévu :
  p16 « froid et nuit » (PR #6) vient de la relance manuelle du 07/11 ; p14 « GPS en forêt et de nuit » et
  p15 « plaque carbone en trail » (PR #8) viennent d'une session de Cyprien, sujets choisis dans la veille.
  Depuis son passage prévu du 01/11 (arrêté en 15 s par la limite d'usage), la routine n'a été déclenchée
  qu'une fois, à la main le 07/11 (`RemoteTrigger get` : `last_fired_at` ; `list_runs`). À la
  relecture finale de p16, deux imprécisions ont été corrigées : les seuils de température de l'app portent
  sur la maximale prévue du jour, pas sur l'heure de la sortie ; et un optimum (El Helou 2012) suppose aussi
  une baisse de vitesse du côté froid.

## Résolues le 08/11/2026

- `@Plume` débloqué (PR #3 relue, corrigée, fusionnée, déployée).
- Réseau des routines : 22 domaines autorisés (pacevo.fr et pacevo.app compris), prouvé.
- `@Concierge` : connecteur Gmail branché, redirections OVH prouvées, `COACH_EMAIL` = `contact@pacevo.fr` en production.
- Données personnelles : sauvegarde chiffrée en place.
- Limite d'usage : routines déplacées la nuit.

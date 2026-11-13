# État de l'équipe d'agents Pacevo

*Tenu par `@Nexus`. Mis à jour le 13/11/2026 à 7 h (routine Direction). Chaque ligne dit ce qui TOURNE VRAIMENT,
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
Leurs journaux (`list_runs`, `get_run_log`) ne sont pas lisibles depuis une routine : un passage
sans PR ni rapport n'est classé ni « RAS » ni « refus » tant que Cyprien n'a pas lu le journal.

| Routine | Agents | Quand (heure de Paris) | Modèle |
|---|---|---|---|
| Bugs Pacevo | `@Sweeper` (+ visa `@Architect` depuis le 09/11, à prouver) | tous les jours, 6 h et 23 h | Sonnet 5.5 |
| Blog Pacevo, un article sourcé | `@Plume` (+ visa `@Mercator` depuis le 09/11, à prouver) | le 1er et le 15, 3 h | Opus 5 |
| Blog Pacevo, sujets | `@Plume` (+ visa `@Mercator` depuis le 09/11, à prouver) | lundi 3 h 30 | Sonnet 5 |
| Coach Pacevo | `@Sparring`, `@SafeRun` (+ visa `@HeadCoach` depuis le 09/11, à prouver) | lundi 5 h | Opus 5.5 |
| Direction Pacevo | `@Nexus`, `@PostMortem`, `@Greffier` (+ `@Atlas`, `@Strategos`, `@Trésorier`, appelés le 13/11) | vendredi 6 h | Sonnet 5.5 |
| Gazette Pacevo, édition de la lettre (demandée le 10/11, 1er passage le 15/11 à prouver) | `@Gazette` (+ visa `@Maestro`) : une PR, Cyprien fusionne | dimanche 22 h 30 | Opus 5.5 |
| Sécurité et veille Pacevo | `@Bunker`, `@Vault`, `@Radar` (+ contrôle de la sauvegarde publique ; + visas `@Architect` et `@Mercator` depuis le 09/11, à prouver) | le 5 du mois, 4 h | Sonnet 5.5 |

**Tâches locales (Mac de Cyprien, app Claude)** : elles écrivent dans `~/Desktop/Pacevo/`, ce
qu'une routine cloud ne peut pas faire. Leur état n'est pas visible depuis le cloud.

| Tâche | Agent | Quand |
|---|---|---|
| Courrier du matin | `@Concierge` (+ visa `@Chancelier` depuis le 09/11, à prouver) | tous les jours, 8 h |
| Sauvegarde chiffrée de la base | `@TimeMachine` | dimanche 11 h |

**Tâches GitHub Actions** (suivies dans /admin › Automatisation) : synchro du coach, sauvegarde
hebdomadaire des tables publiques (dimanche 03 h 20), newsletter, veille des courses. Au 13/11 :
derniers passages tous réussis ; sauvegarde publique réussie le 08/11 (prochaine le dimanche 15/11) ;
`@Vigie` réussie le 13/11 à 01:58 UTC.
`@Vigie` (`vigie.yml`) sonde pacevo.fr : demandé toutes les 30 min, mais GitHub ne lance les
planifications de ce dépôt que toutes les 3 à 4 heures (mesuré le 09/11 : 2 passages planifiés en
15 h, comme `sync-coach`). Ce trou est comblé depuis le 09/11 par **UptimeRobot** (offre gratuite,
compte de Cyprien, alertes par mail) : deux sondes toutes les 5 min, l'accueil
https://pacevo.fr (HTTP 200) et https://pacevo.fr/version.json (alerte si « commit » disparaît).

**Production** (13/11) : pacevo.fr sert 96f288c1 (fusion de #45), `main` est à ff51926 (fusion de
#46). Une fusion de retard, déploiement sur GO de Cyprien (`/deployer`).

## Vague 1 : 12 agents sur 12 en place

| # | Agent | État | Preuve / remarque |
|---|---|---|---|
| 1 | `@Nexus` | **EXÉCUTÉ** | 13/11 (Direction, 1er passage) : ce fichier et le point de 2 minutes, à partir de `ops/ATLAS_SYNC.md`. |
| 3 | `@Sparring` | **EXÉCUTÉ** | 09/11 (5 h) : profil marathonien sub-3 h ajouté ; 2 défauts du plan trouvés (« /km/km », seuil 3 jours après un marathon), PR #4 fusionnée et en ligne (1e2173c). 3 profils de la matrice manquent encore (`ops/sparring/PROFILS.md`). Prochain passage le 16/11. |
| 7 | `@SafeRun` | PLANIFIÉ | Coach, lundi 16/11. |
| 8 | `@Sweeper` | **EXÉCUTÉ** | 08/11 : pacevo.fr joignable depuis le cloud (version lue), aucun défaut sur 24 h. Filtre `localhost` en place à la source depuis le 06/11. Depuis le 09/11 à 23 h : aucune PR « Bugs », journal non lu (RAS ou refus, non tranché). |
| 9 | `@Bunker` | **EXÉCUTÉ** | 08/11 : 23 → 9 failles de dépendances, Next.js 16.4.5, déployé. Restent `zod` (importé nulle part) et la chaîne ESLint (non utilisée). |
| 10 | `@Vault` | PLANIFIÉ | Sécurité, le 5/12. Lecture seule ; une faille non corrigée ne va jamais dans le dépôt. |
| 21 | `@Plume` | **EXÉCUTÉ** | 09/11 : PR #6 « Courir dans le froid et la nuit » (p16) fusionnée et en ligne (e738e78), née de la relance manuelle du 07/11, avant le visa `@Mercator`. Blog sujets du 10/11 : aucune PR, journal non lu. Prochain article le 15/11 à 3 h (cron `0 3 1,15 * *`, heure de Paris). |
| 26 | `@Radar` | PLANIFIÉ | Sécurité et veille, le 5/12. Sites des concurrents autorisés dans le réseau cloud. |
| 34 | `@Greffier` | **EXÉCUTÉ** | 13/11 (Direction, 1er passage) : `ops/greffier/API-MONTRES.md` mis à jour (Strava : interdiction IA confirmée par l'API Policy 2026 ; Garmin : la page officielle ne dit plus « suspendu », reprise non confirmée). Visa `@Trésorier` RENVOYÉ, corrigé, à redemander. |
| 48 | `@TimeMachine` | **EXÉCUTÉ** | 08/11 : 1re sauvegarde chiffrée complète de la base, relue et recomptée. Tâche locale chaque dimanche ; passage du 15/11 non visible depuis le cloud. |
| 61 | `@Concierge` | **EXÉCUTÉ** | 09/11 (8 h 05, 1er passage) : 9 fils classés, 1 brouillon propre (trou « à compléter » au lieu d'inventer), 0 envoi, briefing écrit dans `~/Desktop/Pacevo/`. Passages suivants non visibles depuis le cloud. Le connecteur ne voit pas le Spam. |
| 64 | `@PostMortem` | **EXÉCUTÉ** | 13/11 (Direction) : leçons de la semaine ajoutées à `ops/memory/LESSONS_LEARNED.md` (rechute FC max datée du 12/11, clause incorporée par renvoi, visa = bloc tagué). Visa `@Strategos` RENVOYÉ, corrigé, à redemander. |

## Direction (créée le 09/11/2026) : 11 unités définies, 7 branchées dans les routines, 1er passage Direction le 13/11

Organigramme, rattachements et statuts : `ops/direction/README.md` (source unique, gardée par
`tests/organigramme.test.ts`) ; fiches : `.claude/agents/` (sous-agents en lecture seule, modèle `opus`) ; textes à
ajouter aux routines : `ops/direction/routines/`. Chaîne : agent → directeur de pôle → `@Atlas` → `@Nexus` → Cyprien.
Aucune routine ni quota en plus : un directeur relit dans le passage de son agent, seulement s'il y a une PR ou un
rapport. Statut honnête : « DÉFINI » tant qu'aucune routine n'appelle le sous-agent ; « ACTIF (dans …) » après un
premier passage prouvé (`list_runs`, `get_run_log`). Textes appliqués le 09/11/2026 vers 10 h avec le GO de Cyprien.

**Premier bilan (`ops/ATLAS_SYNC.md`, 13/11) : RENVOYÉ.** Les 43 PR fusionnées depuis le 09/11 (#4 à #46) n'ont
aucun visa de directeur au format exigé (tag, verdict, grille, « Ce que je n'ai pas pu vérifier ») ; huit ne
portent qu'une mention résumée. Seules #4 (Coach) et #6 (Blog p16) viennent de routines, avant le branchement ;
toutes les autres viennent de sessions de Cyprien, qui ne sont pas tenues au visa aujourd'hui.

| # | Agent | Rôle | État | Routine (premier passage à prouver) |
|---|---|---|---|---|
| 1 | `@Nexus` | directeur général délégué, bras droit | ACTIF | Direction ; 1er passage comme sous-agent `nexus` le 13/11 |
| 71 | `@Atlas` | directeur adjoint des opérations, bras gauche | DÉFINI, branché le 09/11 ; appelé le 13/11 (synthèse rendue, RENVOYÉ) | Direction (vendredi) ; ACTIF après lecture du journal du 13/11 |
| 72 | `@Strategos` | pôle A, stratégie et qualité des agents | DÉFINI, branché le 09/11 ; appelé le 13/11 (RENVOYÉ sur les leçons) | Direction ; ACTIF après lecture du journal du 13/11 |
| 73 | `@Chancelier` | pôle B, secrétaire général | DÉFINI, branché le 09/11 | Courrier (Mac, 8 h), après `@Concierge` ; non visible depuis le cloud |
| 74 | `@HeadCoach` | pôle C, directeur scientifique | DÉFINI, branché le 09/11 | Coach (lundi 16/11, 5 h), avant la PR |
| 75 | `@Architect` | pôle D, technique et sécurité | DÉFINI, branché le 09/11 | Bugs (6 h, 23 h) et Sécurité et veille (le 5) ; aucun visa prouvé |
| 76 | `@Maestro` | pôle E, produit et design | DÉFINI | Gazette (15/11) ; à la demande sur toute PR d'interface |
| 77 | `@Mercator` | pôle F, marketing | DÉFINI, branché le 09/11 | Blog (15/11 à 3 h, lundi) et Sécurité et veille (rapport de `@Radar`) |
| 78 | `@Alliance` | pôle G, commercial et partenariats | DÉFINI | avec son pôle (en attente) ; à la demande |
| 79 | `@Trésorier` | pôle H, finance et juridique | DÉFINI, branché le 09/11 ; appelé le 13/11 (RENVOYÉ sur `API-MONTRES.md`) | Direction ; ACTIF après lecture du journal du 13/11 |
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

- Aucune connue. Les tâches locales (`@Concierge`, `@TimeMachine`) ne sont pas visibles depuis le cloud :
  leur état depuis le 09/11 n'est pas vérifié.
- Journaux à lire par Cyprien (`get_run_log`) : Bugs (huit passages du 09/11 23 h au 13/11 6 h, aucune PR),
  Blog sujets du 10/11 (aucune PR), Direction du 13/11. Sans cette lecture, rien ne distingue un vrai RAS d'un
  refus pour limite d'usage.

## BLOQUÉES ou en cours

1. **Sauvegarde des données personnelles** : couverte chaque semaine sur le Mac (chiffrée), mais
   pas de copie quotidienne côté hébergeur tant que Supabase est sur l'offre gratuite. Passage à
   l'offre Pro à décider au lancement.
2. **PR Direction du 13/11** (`ops/ATLAS_SYNC.md`, `ops/greffier/API-MONTRES.md`,
   `ops/memory/LESSONS_LEARNED.md`) : à ouvrir. Les nouveaux visas de `@Strategos` et `@Trésorier` sur
   les versions corrigées sont à redemander, puis fusion sur GO de Cyprien.
3. **Garmin** : la page officielle relue le 13/11 ne dit plus « suspendu », mais aucun texte daté ne
   confirme la reprise. La correction 6 de `ops/CONSTITUTION.md` et `.claude/agents/maestro.md` disent
   encore « suspendu ». À reformuler ou non : décision de Cyprien.
4. **Strava** : l'interdiction d'utiliser ses données dans une IA est confirmée (API Policy 2026,
   incorporée par renvoi dans l'accord). À vérifier (`@Architect`, `@Trésorier`) : aucune séance Strava
   relayée par intervals.icu ne doit atteindre Gemini. Non vérifié à ce jour.
5. **Description de la PR #43** : à corriger (signalée par `@Atlas`, le détail est dans la synthèse).
6. **Visas des PR de session** : les PR ouvertes en session doivent-elles aussi porter le visa de leur
   directeur (texte du plan → `@Architect`, i18n → `@Maestro`, IA → `@Conductor`, texte légal →
   `@Trésorier`) ? Décision de Cyprien.

## Résolues le 13/11/2026

- 43 PR fusionnées depuis le 09/11 (#4 à #46), aucune laissée ouverte ni fermée sans fusion.
- 1er passage de la routine Direction avec la chaîne `@Atlas` → `@Nexus` : synthèse écrite dans
  `ops/ATLAS_SYNC.md`.
- Ligne Strava de `ops/greffier/API-MONTRES.md` réécrite (interdiction confirmée, sources citées) ;
  date de la leçon FC max corrigée (12/11), « jamais plus haute » et un signal ajoutés.

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

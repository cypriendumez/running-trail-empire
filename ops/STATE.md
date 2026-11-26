# État de l'équipe d'agents Pacevo

*Tenu par `@Nexus`. Mis à jour le 13/11/2026 à 7 h (routine Direction) ; retouché en session le 16/11/2026 (production, PR #47, #51, #54, #55 et #56) et le 19/11/2026 (contrôle des agents : journaux des routines, tâches du Mac, GitHub Actions). Chaque ligne dit ce qui TOURNE VRAIMENT,
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

**Contrôle du 19/11 (journaux lus en session) : la limite HEBDOMADAIRE a coupé l'équipe du 17/11 au
soir au 19/11 à 12 h.** Journal : `rate_limit: rejected (seven_day)`, passage arrêté en une seconde. Touchés :
Bugs (17/11 23 h, 18/11 6 h et 23 h, 19/11 6 h : les quatre ont duré une dizaine de secondes ; journaux lus
pour 17/11 23 h et 19/11 6 h) et le courrier de `@Concierge` (19/11, aussi le 11/11). Les routines de nuit sont
les premières à tomber quand les sessions de la semaine ont consommé la limite : un passage de moins de
30 s est un refus, pas un RAS. Les 7 routines sont actives (`RemoteTrigger list`, 19/11).

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
hebdomadaire des tables publiques (dimanche 03 h 20), newsletter, veille des courses. Au 19/11 :
les 60 derniers passages (12 tâches) tous réussis ; sauvegarde publique réussie le 15/11 ; lettre du
lundi partie le 16/11 ; `@Vigie` réussie le 19/11 à 04:35 UTC.
`@Vigie` (`vigie.yml`) sonde pacevo.fr : demandé toutes les 30 min, mais GitHub ne lance les
planifications de ce dépôt que toutes les 3 à 4 heures (mesuré le 09/11 : 2 passages planifiés en
15 h, comme `sync-coach`). Ce trou est comblé depuis le 09/11 par **UptimeRobot** (offre gratuite,
compte de Cyprien, alertes par mail) : deux sondes toutes les 5 min, l'accueil
https://pacevo.fr (HTTP 200) et https://pacevo.fr/version.json (alerte si « commit » disparaît).

**Production** (13/11) : pacevo.fr sert 96f288c1 (fusion de #45), `main` est à ff51926 (fusion de
#46). Une fusion de retard, déploiement sur GO de Cyprien (`/deployer`).
**Production au 16/11** (relevé en session, 15 h 40) : pacevo.fr sert `8476e160`, la tête de `main` avant
la fusion de la PR #54 (#48, #49, #50, #52, #53, #55 et #56 en ligne ; #47 et #54 ne changent que `ops/` et
des tests). Plus de retard de code.
**Production au 19/11** (relevé en session) : pacevo.fr sert `24637bab`, la tête de `main` (#57 à #61 en ligne).
Plus de retard de code.
**Production au 23/11** (relevé en session, `pacevo.fr/version.json`) : pacevo.fr sert `5a536813`, la tête de `main`
depuis le 20/11 (#63, antécédents qui interdisent l'effort maximal, et #64, plafond de volume après plus de 28 jours
d'arrêt, en ligne). Plus de retard de code.

## Vague 1 : 12 agents sur 12 en place

| # | Agent | État | Preuve / remarque |
|---|---|---|---|
| 1 | `@Nexus` | **EXÉCUTÉ** | 13/11 (Direction, 1er passage) : ce fichier et le point de 2 minutes, à partir de `ops/ATLAS_SYNC.md`. |
| 3 | `@Sparring` | **EXÉCUTÉ** | 09/11 (5 h) : profil marathonien sub-3 h ajouté ; 2 défauts du plan trouvés (« /km/km », seuil 3 jours après un marathon), PR #4 fusionnée et en ligne (1e2173c). 16/11 (5 h) : profil 7 (emploi du temps chaotique) éprouvé, PR #54 (tests et matrice seuls) ; les 8 profils de la matrice ont un test (`ops/sparring/PROFILS.md`) ; un défaut de reprise trouvé, corrigé par la PR #57, en ligne au 19/11 (voir « BLOQUÉES », point 8). |
| 7 | `@SafeRun` | **EXÉCUTÉ** | 16/11 (Coach) : `kine.crash`, `douleurs-course` et `sante` verts ; Kiné IA toujours retiré ; aucun diagnostic dans les textes servis après une douleur ; rien à corriger (PR #54). |
| 8 | `@Sweeper` | **EXÉCUTÉ** | 08/11 : pacevo.fr joignable depuis le cloud (version lue), aucun défaut sur 24 h. Filtre `localhost` en place à la source depuis le 06/11. Depuis le 09/11 à 23 h : aucune PR « Bugs ». Journal du 16/11 à 23 h lu le 19/11 : vrai RAS (`error_logs` vide hors source `reseau` sur 24 h, aucune PR ouverte). Du 17/11 à 23 h au 19/11 à 6 h : quatre passages refusés par la limite hebdomadaire. |
| 9 | `@Bunker` | **EXÉCUTÉ** | 08/11 : 23 → 9 failles de dépendances, Next.js 16.4.5, déployé. Restent `zod` (importé nulle part) et la chaîne ESLint (non utilisée). |
| 10 | `@Vault` | PLANIFIÉ | Sécurité, le 5/12. Lecture seule ; une faille non corrigée ne va jamais dans le dépôt. |
| 21 | `@Plume` | **EXÉCUTÉ** | 09/11 : PR #6 « Courir dans le froid et la nuit » (p16) fusionnée et en ligne (e738e78), née de la relance manuelle du 07/11, avant le visa `@Mercator`. 15/11 (3 h) : PR #50 « Le sommeil », double relecture `verificateur-sources` et visa `@Mercator` ACCORDÉ, fusionnée. Blog sujets du 16/11 (journal lu le 19/11) : 6 sujets, RENVOYÉ par `@Mercator` (doublon de p17, chiffre « 14 000 courses » périmé, sujet contraire à `repriseArret.ts`), puis VISA ACCORDÉ à 5 sujets ; rapport rendu dans le journal, pas de PR (normal pour cette routine). |
| 26 | `@Radar` | PLANIFIÉ | Sécurité et veille, le 5/12. Sites des concurrents autorisés dans le réseau cloud. |
| 34 | `@Greffier` | **EXÉCUTÉ** | 13/11 (Direction, 1er passage) : `ops/greffier/API-MONTRES.md` mis à jour (Strava : interdiction IA confirmée par l'API Policy 2026 ; Garmin : la page officielle ne dit plus « suspendu », reprise non confirmée). Visa `@Trésorier` RENVOYÉ, corrigé, à redemander. |
| 48 | `@TimeMachine` | **EXÉCUTÉ** | 08/11 : 1re sauvegarde chiffrée complète de la base, relue et recomptée. Tâche locale chaque dimanche. **Le passage du 15/11 n'a rien produit** (aucune archive, aucune trace de passage dans l'app, cause inconnue) : 11 jours sans sauvegarde privée. Relancé en session le 19/11 : archive du 19/11 VALIDE (51 tables, 20 184 lignes, 12 comptes, 8,9 Mo), 2 archives gardées ; `journal.md` créé dans le dossier des sauvegardes (hors dépôt) pour voir un dimanche manqué. |
| 61 | `@Concierge` | **EXÉCUTÉ** | 09/11 (8 h 05, 1er passage) : 9 fils classés, 1 brouillon propre (trou « à compléter » au lieu d'inventer), 0 envoi, briefing écrit dans `~/Desktop/Pacevo/`. Du 09/11 au 19/11 (relevé sur le Mac) : 8 passages réussis sur 11 jours ; échecs les 11/11 et 19/11 (limite hebdomadaire), aucun passage les 14, 15 et 18/11, plusieurs passages tardifs (Mac éteint ou en veille à 8 h, probablement). Courrier du 19/11 relancé en session. Le connecteur ne voit pas le Spam. |
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
| 74 | `@HeadCoach` | pôle C, directeur scientifique | DÉFINI, branché le 09/11 ; appelé le 16/11 (deux visas RENVOYÉ recopiés dans la PR #54 de la routine, puis VISA ACCORDÉ en session le 16/11) | Coach (lundi 5 h), avant la PR ; ACTIF après lecture du journal du 16/11 |
| 75 | `@Architect` | pôle D, technique et sécurité | DÉFINI, branché le 09/11 | Bugs (6 h, 23 h) et Sécurité et veille (le 5) ; aucun visa prouvé |
| 76 | `@Maestro` | pôle E, produit et design | DÉFINI | Gazette (15/11) ; à la demande sur toute PR d'interface |
| 77 | `@Mercator` | pôle F, marketing | ACTIF (Blog) : visa dans la PR #50 (15/11) et dans le journal des sujets du 16/11, lu le 19/11 (RENVOYÉ puis VISA ACCORDÉ) | Blog (le 1er et le 15, lundi) et Sécurité et veille (rapport de `@Radar`, le 5/12) |
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

- **Limite hebdomadaire** (19/11) : elle a coupé Bugs et le courrier du 17/11 au soir au 19/11 à 12 h. Le
  remède n'est pas technique : moins de sessions en parallèle en début de semaine, ou une offre avec plus
  d'usage. Décision de Cyprien.
- **Veille des concurrents** (tâche locale unique prévue le 16/11) : jamais démarrée, son dossier de travail est
  introuvable (`start_failed, folder_missing`). À re-dater avec le bon dossier, ou à abandonner : décision de Cyprien.
- `@TimeMachine` : constater le passage automatique du dimanche 22/11 (une ligne de plus dans `journal.md`).
- Journaux encore à lire (`get_run_log`) : Direction du 13/11, Coach du 16/11 (pour passer `@Atlas`,
  `@Strategos`, `@Trésorier` et `@HeadCoach` en ACTIF).

## BLOQUÉES ou en cours

1. **Sauvegarde des données personnelles** : couverte chaque semaine sur le Mac (chiffrée), mais
   pas de copie quotidienne côté hébergeur tant que Supabase est sur l'offre gratuite. Passage à
   l'offre Pro à décider au lancement.
2. **PR Direction du 13/11** (#47) : visas redemandés en session le 16/11/2026, verdicts complets dans
   la description de la PR. `@Trésorier` : VISA ACCORDÉ au second tour du 16/11, après reprise de
   `ops/greffier/API-MONTRES.md` (créer un client Polar vaut acceptation d'un accord de licence : Niveau 3,
   Cyprien seul). `@Strategos` : VISA ACCORDÉ au troisième tour du 16/11, après deux reprises de
   `ops/memory/LESSONS_LEARNED.md`. GO de fusion donné par Cyprien en session le 16/11.
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

7. **Gazette, candidats périmés** : 1er passage de la routine le 15/11 ; sa PR #51 a été fermée sans fusion
   le 16/11 (visa `@Maestro` BLOQUÉ : l'édition était choisie sur les candidats du 09/11). Sans édition
   fusionnée, la lettre du 16/11 suit son ordre automatique (envoi non contrôlé dans cette session). Cause probable, relue dans `src/app/api/newsletter/candidats/route.ts`
   et constatée en ligne le 16/11 : `unstable_cache` sert l'ancienne collecte au premier appel après une longue
   pause et ne la refait qu'en arrière-plan. Corrigé et en ligne le 16/11 (#55, `f252dddd`) : une collecte
   par tranche de trente minutes pour les candidats et pour le fil lu par la lettre, contrôle de fraîcheur dans
   le skill `edition-lettre`. Prouvé en ligne le 16/11 : collecte faite avant de répondre au premier appel d'une
   tranche, non refaite dans la tranche. Reste à constater au passage de `@Gazette` du dimanche 22/11.
   Suite en ligne le 16/11 (#56, `8476e160`) : une collecte en échec ne sort plus une
   rubrique vide en silence. Une panne = une erreur du fil ou une collecte dont aucun flux n'a répondu, jamais
   une liste vide. Elle se dit dans les candidats (`pannes`, rien n'est écrit en base depuis ce point public),
   dans chaque réponse de la lettre et dans `error_logs` (source `lettre-collecte`, écrit par la lettre du lundi).
   Contrôlé en ligne : `pannes` vide avec les vrais flux. Aucune panne réelle n'a été provoquée en production,
   et une panne partielle (un flux sur plusieurs répond) reste sans signal.
8. **Reprise après un arrêt : une qualité dès le premier jour** (défaut EN PRODUCTION, trouvé par `@Sparring` le
   16/11, confirmé et rejoué par `@HeadCoach`, PR #54). Après 6 à 25 jours sans courir, sans qualité manquée, le
   plan pose une séance au seuil le jour même sur 8 départs sur 10, et une « sortie longue » de 4 km : la reprise
   (`repriseArret`) ne borne que le volume, jamais l'intensité. Avis de `@HeadCoach` : aucune qualité tant que le
   coureur n'a pas couru au moins une sortie facile depuis l'arrêt ; ne pas appeler « sortie longue » une sortie
   plus courte qu'une sortie habituelle. Correction écrite le 17/11 en session, à la demande de Cyprien, sur la
   branche `fix/reprise-sans-qualite` (`qualitePendantReprise` dans `lib/coach/repriseArret`) : aucune qualité avant
   une sortie facile, une seule par semaine ensuite (au seuil, courte), la seconde moitié de la reprise après plus de
   14 jours d'arrêt ; sortie longue facile pendant toute la reprise, footings simples avant le premier jour où
   une séance dure est permise. L'arrêt se compte désormais en jours SANS COURIR avant comme après la première sortie : la
   règle de volume existante s'applique donc de 6 à 28 jours sans courir, soit du 7ᵉ au 29ᵉ jour depuis la dernière
   sortie (un jour plus tard qu'avant à la borne basse, un jour de plus à la borne haute). Le seuil de 14 jours, la
   borne « une par semaine au seuil » et ce décompte ont été jugés conformes par `@HeadCoach` le 17/11 (visa RENVOYÉ
   pour un autre motif, corrigé depuis) : au-delà de 28 jours d'arrêt, où la règle de volume ne s'applique plus,
   l'intensité reste bornée (rien de dur avant le 14ᵉ jour d'une reprise de quatre semaines) ; et après dix jours
   d'arrêt, pas de séance dure avant 48 h. Le volume au-delà de 28 jours a depuis reçu son plafond (PR #64, fusionnée et
   EN LIGNE le 20/11, `5a536813`). Suites décidées par `@HeadCoach` le 23/11, écrites en session sur la branche
   `fix/suites-long-arret` (en local, ni poussée ni en ligne) : la règle d'intensité dure jusqu'au début du dernier
   palier de volume puis une marche de sortie de sept jours la suit, pas de test VMA pendant la reprise, la feuille
   de route connaît la reprise, le plancher de deux footings vaut pour toute reprise et la semaine au plancher ne porte que des footings, dernier
   palier à 80 %, et le plafond d'un petit volume se replie sur 12 km au lieu de disparaître. Suite demandée par
   `@HeadCoach`, écrite le 23/11 sur la branche `fix/reprise-petites-semaines` (au-dessus de la précédente, en local) :
   toute semaine de reprise trop petite pour porter le seuil ET un footing ne porte que des footings, la marche de
   sortie écrit ses séances dans la dose courte, et un volume d'avant de 12 km ou moins est plafonné à lui-même. Détail
   et limites : `ops/sparring/PROFILS.md`, profil 4. Reste ouvert : le retour d'un coup du volume à la fin de la
   reprise (la sortie longue et les séances reviennent désormais par la marche de sortie après un long arrêt).
   **Fusionné (PR #57, le 17/11) et EN LIGNE** : pacevo.fr sert `24637bab` le 19/11, qui contient #57 à #61.
   Restent ouverts les deux points ci-dessus.

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

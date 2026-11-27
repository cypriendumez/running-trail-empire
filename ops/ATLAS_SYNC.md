# Synthèse de @Atlas pour @Nexus

*Rempli par la routine Direction chaque vendredi (6 h), à partir du verdict du sous-agent `atlas`, et à la
demande. Fichier PUBLIC : aucune donnée personnelle, aucun chiffre non sourcé, aucune faille non corrigée.
Ce qui est privé est désigné par son dossier dans `~/Desktop/Pacevo/`, jamais recopié.*

## Semaine du 20/11/2026 au 27/11/2026

Passage de `@Atlas` dans la routine Direction du 27/11. Verdict d'ensemble : **RENVOYÉ**.
- Aucune PR de la semaine (#63 à #72) ne porte de visa de directeur au format exigé (tag, verdict, grille, « Ce que je n'ai pas pu vérifier ») : #63, #64, #67, #68 et #70 citent `@HeadCoach` en mention résumée ; #65 et #66 sont des brouillons « [Sans visa] » qui recopient les verdicts les ayant renvoyés ; #69, #71 et #72 n'en citent aucun.
- La PR #72 ajoute un hébergeur de fonds de carte (`tiles.openfreemap.org`, `next.config.ts`) absent de la liste des destinataires de la politique de confidentialité (`src/app/legalI18n.ts`, qui ne cite que MapTiler et OpenStreetMap) ; neuf autres hôtes de tuiles de `next.config.ts` y manquent aussi, manque antérieur à #72 (grep du 27/11). À faire vérifier par `@Trésorier`, puis à corriger en 5 langues.
- Visa `@Trésorier` sur `ops/greffier/API-MONTRES.md` : **BLOQUÉ** (sa lecture des quatre pages officielles a été refusée par ses permissions) ; à lever par Cyprien. Visa `@Strategos` du 27/11 : ACCORDÉ avant l'ajout de deux leçons par la routine (raisons de la Gazette ; CSP et confidentialité), visa redemandé ensuite : RENVOYÉ, leçons corrigées, nouveau visa à redemander.
- Le passage Direction du 20/11 n'a laissé ni PR, ni commit, ni synthèse. Règle candidate de `@Strategos` : « un passage Direction se termine toujours par une PR, même RAS », à confirmer par une 2ᵉ occurrence.

Sources : API REST GitHub (PR #63 à #72, corps, runs Actions), `git log`, https://pacevo.fr/version.json (relu le 27/11 : `87a983e8`, tête de `main`).

### PR de la semaine

8 fusionnées (#63, #64, #67 à #72), 2 ouvertes en brouillon (#65 Gazette depuis le 22/11, #66 Coach depuis le 23/11, aucune de plus de 7 jours), aucune fermée sans fusion.

| PR | Pôle | Directeur | Visa au format | Remarque |
|---|---|---|---|---|
| #63 | C | `@HeadCoach` | NON (mention résumée) | Touche aussi `src/lib/watch/intervals.ts` (`@Architect`) et l'i18n (`@Maestro`) |
| #64 | C | `@HeadCoach` | NON (mention résumée) | `autoPlan.ts`, `reasonsI18n.ts` |
| #65 | E | `@Maestro` | NON (brouillon, renvoyé 2 fois) | Le verdict recopié n'a pas de ligne « Pour @Atlas » |
| #66 | C | `@HeadCoach` | NON (brouillon, renvoyé 2 fois) | Verdict recopié au format complet |
| #67 | C | `@HeadCoach` | NON (mention résumée) | `autoPlan.ts`, `reasonsI18n.ts` |
| #68 | C | `@HeadCoach` | NON (mention résumée) | Routes d'IA : aussi `@Conductor` ; i18n : `@Maestro` |
| #69 | A | `@Strategos` | NON | `ops/STATE.md` seul |
| #70 | C | `@HeadCoach` | NON (mention résumée) | Une phrase retirée après la relecture finale, sans nouvelle relecture |
| #71 | A | `@Strategos` | NON | `ops/STATE.md` seul |
| #72 | E | `@Maestro` (+ `@Architect`, `@Trésorier`) | NON | CSP élargie, nouvel hébergeur de tuiles absent de la politique de confidentialité |

### Renvoyé à un pôle

- **Pôle H (`@Trésorier`), #72** : politique de confidentialité à compléter (OpenFreeMap reçoit l'adresse IP du navigateur).
- **Pôle A (`@PostMortem`)** : causes des deux refus de #65 et #66 à porter au fichier de leçons ; la leçon « `auth.crash` sans DNS dans le cloud » existe déjà (09/11), à ne pas dupliquer ; celle sur la lecture de `noHistory` sur 60 séances tous sports rejoint la leçon du 19/11.
- **Pôle E (`@Gazette`)** : ligne « Pour @Atlas » manquante dans le verdict recopié de #65.
- **PR de session** : décision « visas des PR de session » toujours attendue de Cyprien.

### Dépendances entre pôles

- `@Architect` absent de #63, #64, #66, #67, #68, #70 (touchent `autoPlan.ts`) et de #72 (CSP).
- `@Maestro` absent des PR qui touchent les fichiers i18n (#63, #64, #66, #67, #68, #70) et de #72.
- `@Conductor` absent de #68 (routes d'IA).
- Garmin : la correction 6 de `ops/CONSTITUTION.md` et `.claude/agents/maestro.md` disent encore « suspendu » ; la page officielle ne le dit plus depuis le 13/11 (texte de Cyprien, signalé sans modification).
- Strava → Gemini : toujours non vérifié (STATE.md, BLOQUÉES, point 4).

### Passages de routines suspects

- Journaux des routines cloud non lus (illisibles depuis une routine) : aucun passage sans PR ne se classe « refus » ou « RAS ». À lire : Direction du 20/11, Bugs depuis le 20/11 (aucune PR « Bugs »), Blog sujets du 23/11.
- Gazette (22/11) et Coach (23/11) : passages réels, prouvés par #65 et #66.
- Tâches du Mac (`@Concierge`, `@TimeMachine`) : invisibles depuis le cloud.
- GitHub Actions : tous les passages relevés réussis ; sauvegarde publique le 22/11 ; `@Vigie` le 27/11 à 02:18 UTC.

### Ce qui attend le GO de Cyprien

- PR #65 (Gazette, brouillon sans visa) : fermer ou garder comme trace. PR #66 (Coach, brouillon sans visa) : trois corrections de `@HeadCoach` restent à faire.
- PR Direction du 27/11 : à fusionner sur GO.
- Visa `@Trésorier` : lire les quatre pages officielles, ou accorder la lecture réseau au sous-agent.
- Politique de confidentialité (hébergeur de tuiles de #72) ; correction 6 sur Garmin ; visas des PR de session ; PR #43 (corps à relire) ; offre Pro de Supabase au lancement.

### Pour @Nexus (une ligne)

Semaine du 20 au 27/11, RENVOYÉ : aucun visa au format sur #63 à #72, #65 et #66 renvoyés deux fois, #72 sans mention du nouvel hébergeur de tuiles dans la confidentialité, visa `@Trésorier` BLOQUÉ, passage Direction du 20/11 sans trace ; la production est à jour (`87a983e8`).

## Semaine du 06/11/2026 au 13/11/2026

Premier passage de `@Atlas` (routine Direction du 13/11). Verdict d'ensemble : **RENVOYÉ**.
- Aucune PR de la semaine ne porte de visa de directeur au format exigé.
- Deux corrections de ce passage sont à reprendre (ligne Strava, date d'une leçon).
- Le corps d'une PR publique est à relire avant fusion de celle-ci (détail dans le compte rendu privé).

Sources de ce fichier : API REST GitHub (liste des PR et de leurs fichiers, runs Actions), `git log origin/main`,
https://pacevo.fr/version.json, pages officielles Strava relues le 13/11/2026.

> **Reprises faites après cette synthèse, dans le même passage** : ligne Strava réécrite (interdiction confirmée par
> l'API Policy 2026, relue par la routine), date de la leçon FC max corrigée (12/11), « jamais plus haute » et signaux
> ajoutés, deux leçons ajoutées (clause incorporée par renvoi ; visa = bloc tagué). Les visas de @Strategos et de
> @Trésorier sur ces versions corrigées ne sont PAS obtenus : à redemander au prochain passage.

## PR de la semaine

43 PR créées entre le 09/11 et le 13/11, toutes fusionnées (#4 à #46). Aucune n'est ouverte, aucune n'a été fermée
sans fusion. 172 commits sur `main` depuis le 06/11.

Les PR #4 à #6 sont nées de routines avant le branchement des directeurs (09/11 vers 10 h) ; toutes les
autres sont des sessions de Cyprien.

« Mention résumée » = le corps cite une relecture de directeur (« directeur scientifique : HOMOLOGUÉ »,
« tresorier : RENVOYÉ, puis VISA ») sans tag `[@Nom]`, sans VISA ACCORDÉ et sans grille. Cela ne vaut pas visa.

| PR | Pôle | Directeur | Visa dans la description | Verdict | Remarque |
|---|---|---|---|---|---|
| #4 | C | @HeadCoach | NON | [Sans visa] | Routine Coach du 09/11, avant le branchement ; touche `autoPlan.ts` (texte lu par la montre) |
| #5 | C | @HeadCoach | NON | [Sans visa] | `autoPlan.ts` + `planI18n.ts` |
| #6 | F | @Mercator | NON | [Sans visa] | Blog p16, relance manuelle du 07/11, avant le branchement |
| #7 | A | @Strategos | NON | [Sans visa] | Création de la direction (documentation `ops/`, fiches) |
| #8 | F | @Mercator | NON | [Sans visa] | Blog p14, p15 (session) |
| #9 | A | @Strategos | NON | [Sans visa] | Textes de routines appliqués |
| #10 | A | @Strategos | NON | [Sans visa] | Alignement de la direction |
| #11 | D | @Architect | NON | [Sans visa] | Compétence `/deployer` |
| #12 | A | @Strategos | NON | [Sans visa] | `ops/STATE.md` |
| #13 | A | @Strategos | NON | [Sans visa] | Leçons @Plume |
| #14 | E | @Maestro | NON | [Sans visa] | Interface + CSP (aussi @Architect) |
| #15 | E | @Maestro | NON | [Sans visa] | Interface, i18n |
| #16 | E | @Maestro | NON | [Sans visa] | Tableau de bord, i18n, risque de blessure (aussi @HeadCoach) |
| #17 | C | @HeadCoach | NON | [Sans visa] | Prédictions (aussi @Oracle) |
| #18 | C | @HeadCoach | NON | [Sans visa] | `autoPlan.ts` + `planI18n.ts` |
| #19 | C | @HeadCoach | NON | [Sans visa] | `autoPlan.ts`, interface |
| #20 | D | @Architect | NON | [Sans visa] | Tracés de parcours, i18n |
| #21 | D | @Architect | NON | [Sans visa] | Tracés de parcours |
| #22 | E | @Maestro | NON | [Sans visa] | Lettre du lundi |
| #23 | D | @Architect | NON | [Sans visa] | Cache des tracés |
| #24 | E | @Maestro | NON | [Sans visa] | Lettre du lundi |
| #25 | D | @Architect | NON | [Sans visa] | Tracés, `estErreurTransitoire` |
| #26 | E | @Maestro | NON | [Sans visa] | Lettre du lundi |
| #27 | E | @Maestro | NON | [Sans visa] | Lettre du lundi |
| #28 | C | @HeadCoach | NON | [Sans visa] | `autoPlan.ts`, `coach/footings`, `coach/qualityBudget` |
| #29 | E | @Maestro | NON | [Sans visa] | Lettre du lundi |
| #30 | C | @HeadCoach | NON | [Sans visa] | Arrêts relus sur la trace et donnés au coach (aussi @Conductor), i18n |
| #31 | E | @Maestro | NON | [Sans visa] | Décrit le visa @Maestro que demandera la future routine Gazette : aucun verdict dans le corps |
| #32 | D | @Architect | NON | [Sans visa] | Connexion montre, `src/lib/intervals/` |
| #33 | C | @HeadCoach | NON | [Sans visa] | Douleur, `coach/arretsQualite` |
| #34 | C | @HeadCoach | NON | [Sans visa] | Arrêts mémorisés |
| #35 | E | @Maestro | NON | [Sans visa] | Bandeau d'installation, i18n |
| #36 | C | @HeadCoach | NON | Mention résumée (@Trésorier) | Fiches kiné : visa juridique résumé sans grille ; ni @HeadCoach ni @Conductor |
| #37 | C | @HeadCoach | NON | Mention résumée | `autoPlan.ts` + `planI18n.ts`, Kiné |
| #38 | C | @HeadCoach | NON | Mention résumée | `autoPlan.ts` |
| #39 | C | @HeadCoach | NON | [Sans visa] | Santé, interface |
| #40 | C | @HeadCoach | NON | Mention résumée | Questionnaire d'aptitude : touche `legalI18n.ts` (texte légal, aucun @Trésorier) |
| #41 | C | @HeadCoach | NON | Mention résumée | Page « Comment Pacevo calcule », `autoPlan.ts`, i18n |
| #42 | C | @HeadCoach | NON | Mention résumée | FC max sans repli inventé ; contexte envoyé à l'IA (aussi @Conductor) |
| #43 | C | @HeadCoach | NON | Mention résumée | Une seule FC max, une seule VMA. Corps de PR à relire (voir plus bas) |
| #44 | E | @Maestro | NON | [Sans visa] | Bandeau de panne, i18n |
| #45 | E | @Maestro | NON | [Sans visa] | Bandeau, langue du compte |
| #46 | J | @Conductor | NON | [Sans visa] | Langue des textes de l'IA, i18n (aussi @Maestro) |

Verdicts de directeurs rendus dans ce passage (routine Direction du 13/11), sur le diff `ops/` non commité :

| Livrable | Directeur | Verdict | Suite |
|---|---|---|---|
| Leçons de la semaine (`ops/memory/LESSONS_LEARNED.md`) | @Strategos | RENVOYÉ | Corrigé, visa non redemandé ; relu par @Atlas : deux reprises (voir plus bas) |
| `ops/greffier/API-MONTRES.md` | @Trésorier | RENVOYÉ | Corrigé, visa non redemandé ; relu par @Atlas : ligne Strava inexacte (voir plus bas) |

## Renvoyé à un pôle

- **Pôle H (@Greffier, puis visa @Trésorier)** : la ligne Strava de `ops/greffier/API-MONTRES.md` dit que la clause
  sur l'IA n'est « pas retrouvée » dans l'accord 2026 ; l'interdiction n'y est « maintenue que par prudence ».
  - L'accord intègre par renvoi l'« API Policy (2026) » (https://www.strava.com/legal/api_policy), en vigueur au
    1er juin 2026.
  - Sa section 5.3 interdit d'utiliser les données Strava dans toute application d'IA, y compris pour remplir une
    fenêtre de contexte. Sa section 5.4 interdit aussi l'agrégation et l'analytique.
  - Il faut donc écrire : interdiction CONFIRMÉE, sources exactes, lien ajouté. Puis demander à nouveau le visa de
    @Trésorier.
- **Pôle A (@PostMortem, puis visa @Strategos)**, trois reprises dans `ops/memory/LESSONS_LEARNED.md` :
  - Ligne 33 : la rechute (PR #42) date du 12/11/2026, pas du 13/11.
  - Ligne 33 : « VMA… donc plus basse » doit devenir « jamais plus haute ». La PR dit « identique » quand une séance
    dure est dans la fenêtre.
  - 1re leçon du 13/11 : il manque un « Signal : » explicite.
  - Puis demander à nouveau le visa de @Strategos.
- **Toutes les PR de la semaine** : aucun visa au format.
  - Les relectures citées (« directeur scientifique : HOMOLOGUÉ » sur #37, #38, #40, #41, #42, #43 ; « tresorier :
    VISA » sur #36) doivent, à l'avenir, être collées telles quelles : tag, verdict, grille, « Ce que je n'ai pas pu
    vérifier ».
  - Rappel adressé aux sessions qui ouvrent des PR, à décider par Cyprien : les directeurs ne sont pas obligatoires
    hors routines.
- **PR #43 (Cyprien)** : la section « Mesure en production » du corps de la PR est à relire et à anonymiser ; détail dans le compte rendu privé.

## Dépendances entre pôles

- **Texte du plan → montre (@Architect)** : #4, #5, #18, #19, #28, #37, #38, #40 et #41 modifient
  `src/lib/ai/autoPlan.ts` ; #5, #18 et #37 modifient aussi `planI18n.ts`. La montre analyse la prose française
  (`src/lib/watch/intervals.ts`). @Architect n'apparaît sur aucune d'elles.
- **Interface en 5 langues (@Maestro)** : #15, #16, #20, #30, #35, #37, #40, #41, #43, #44, #45 et #46 touchent des
  fichiers i18n. Aucun visa @Maestro.
- **Fonctions embarquées (@Conductor)** : #30 (arrêts donnés à l'analyse), #36 et #37 (Kiné), #42 et #43 (contexte
  envoyé à l'IA, analyse de séance), #46 (langue des textes de l'IA). Aucun visa @Conductor.
- **Texte légal (@Trésorier)** : #40 modifie `src/app/legalI18n.ts` sans @Trésorier. #36 a une relecture juridique
  résumée, et des points y sont laissés à un juriste avant toute signature.
- **Données de coureurs agrégées (@Oracle)** : #17 (prédictions) ; #42 et #43 (mesures en production, en lecture
  seule). Aucun visa @Oracle.
- **Règle FC max / VMA des leçons (@HeadCoach)** : suggérée par @Strategos, à faire homologuer sur la leçon corrigée.
- **Strava, API Policy 2026, sections 5.3 et 5.4 (@Trésorier, @Architect, et @Alliance pour @Trophy)** : vérifier
  qu'aucune séance venue de Strava, relayée par intervals.icu, n'atteint Gemini. La section 5.3 couvre aussi les
  données dérivées. Non vérifié ici.
- **Garmin (Cyprien, @Maestro)** :
  - `ops/CONSTITUTION.md` (correction 6) et `.claude/agents/maestro.md` (ligne 49) disent encore « Garmin a
    suspendu ».
  - La page officielle relue le 13/11 ne le dit plus ; la reprise des demandes n'est pas confirmée par un texte daté.
  - Signalé sans modification : la correction 6 est un texte de Cyprien.

## Passages de routines suspects

- **Journaux des routines cloud non lus** : `@Atlas` n'a pas accès à `get_run_log`. Aucun passage ne peut être classé
  « refus pour limite d'usage » ou « vrai RAS ».
- **Bugs (6 h et 23 h, avec @Architect depuis le 09/11)** : huit passages prévus selon l'horaire de `ops/STATE.md`,
  du 09/11 23 h au 13/11 6 h, et aucune PR « Bugs ». Il faut lire le journal : RAS ou refus. Le premier visa
  @Architect n'est toujours pas prouvé.
- **Blog sujets (lundi 3 h 30, avec @Mercator)** : passage du 10/11 non visible d'ici, aucune PR. Journal à lire.
- **Courrier (tâche locale, avec @Chancelier depuis le 10/11)** : invisible d'ici. Premier visa @Chancelier non
  prouvé.
- **Pas encore dus** : Gazette (1er passage le 15/11 à 22 h 30), Blog article (15/11 à 3 h), Coach (16/11 à 5 h),
  Sécurité et veille (05/12).
- **Direction** : ce passage est le premier.
  - @Strategos et @Trésorier ont rendu RENVOYÉ, et leurs corrections n'ont pas été soumises à nouveau.
  - Le passage à « ACTIF (dans Direction) » de @Atlas, @Strategos et @Trésorier attend la lecture du journal de ce
    passage.
- **GitHub Actions** : 13 workflows depuis le 06/11, 0 échec.
  - Sauvegarde des données réussie le 08/11 ; prochaine attendue le dimanche 15/11.
  - Vigie : dernier succès le 13/11 à 01:58 UTC.

## Tâches À RATTRAPER et BLOQUÉES

- **À RATTRAPER** : aucune connue. Les tâches locales (@Concierge, @TimeMachine) sont invisibles depuis le cloud :
  leur état n'est pas vérifié.
- **BLOQUÉE** : pas de sauvegarde quotidienne côté hébergeur tant que Supabase est sur l'offre gratuite. Passage à
  l'offre Pro à décider (Cyprien). La sauvegarde hebdomadaire chiffrée sur le Mac couvre l'intervalle.

## Ce qui attend le GO de Cyprien

- **Déploiement** : la production sert 96f288c1 (fusion de #45), `main` est à ff51926 (fusion de #46). La prod a une
  fusion de retard. Procédure `/deployer`.
- **PR #43** : relire et anonymiser la section « Mesure en production » de son corps.
- **PR Direction du 13/11** (documentation `ops/`) : à fusionner après la reprise de la ligne Strava et des leçons, et
  les nouveaux visas de @Trésorier et @Strategos.
- **Garmin** : décider s'il faut reformuler la correction 6 de `ops/CONSTITUTION.md` et `.claude/agents/maestro.md`
  (ligne 49), avec @Maestro.
- **Visas des PR de session** : dire si les PR ouvertes en session doivent aussi porter le visa de leur directeur
  (aujourd'hui, seules les routines y sont tenues).
- **Statuts « ACTIF (dans Direction) »** de @Atlas, @Strategos et @Trésorier, après lecture du journal de ce passage.
- **Offre Pro de Supabase** (sauvegarde quotidienne) : décision au lancement.

## Pour @Nexus (une ligne)

- Première synthèse Direction, RENVOYÉ.
  - 43 PR fusionnées (#4 à #46), aucune avec un visa de directeur au format ; #31 n'en porte pas.
  - À reprendre : la ligne Strava (interdiction IA CONFIRMÉE par l'API Policy 2026, section 5.3) et la date de la
    leçon FC max (12/11).
  - Corps de la PR #43 à relire et anonymiser (détail privé).
  - La prod a une fusion de retard (#46).
  - Journaux des routines non lus : aucun directeur ne passe ACTIF sur preuve cette semaine.
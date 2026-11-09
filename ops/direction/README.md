# Direction de l'équipe d'agents Pacevo (organigramme, 81 unités + @Vigie)

*Créée le 09/11/2026. Source unique des numéros, des rattachements et des statuts réels : ce fichier.
`tests/organigramme.test.ts` le relit et refuse tout trou, tout doublon, tout agent sans directeur et toute
fiche de direction manquante. Le texte du fondateur (`ops/CONSTITUTION.md`, 70 unités) reste intact : la
direction s'y ajoute par la correction en vigueur n°15. Dépôt PUBLIC : rien de personnel ici.*

## La chaîne de remontée

`agent du pôle → directeur de pôle (n°72 à 81) → @Atlas (n°71, bras gauche) → @Nexus (n°1, bras droit) → Cyprien Dumez (fondateur, PDG)`

- **Le directeur relit dans le même passage que son agent.** Une pull request n'attend jamais une réunion :
  la routine qui l'ouvre appelle le sous-agent du directeur juste avant, colle son visa dans la description,
  et c'est tout. @Atlas et @Nexus consolident le vendredi (routine Direction).
- **Aucune routine ni tâche planifiée supplémentaire.** Les routines partagent le quota hebdomadaire et la
  limite des 5 heures de Cyprien (correction 9 de la constitution, règle 4 du texte) : un directeur est un
  sous-agent de `.claude/agents/` appelé DANS la routine de son pôle, seulement s'il y a un livrable à relire.
  S'il n'y a rien (« RAS »), personne n'est appelé.
- **Les directeurs relisent et consolident.** Ils ne codent pas, ne modifient aucun fichier, ne commitent
  rien, n'envoient rien, ne paient rien et ne décident rien à la place de Cyprien. Leurs outils : Read, Grep,
  Glob, Bash en lecture (`git diff`, `git log`, `grep`, lancer un test).
- **Le GO reste à Cyprien**, toujours : fusion, déploiement, envoi, paiement, écriture en base, signature.
- **Statut honnête.** Un directeur dont aucune routine n'appelle encore le sous-agent est « DÉFINI », pas
  actif. Il passe « ACTIF (dans <routine>) » après un premier passage réussi et prouvé (`list_runs`,
  `get_run_log`), jamais avant.

## Appeler un directeur

- **Dans une routine** (claude.ai) ou une session : outil Agent, `subagent_type` = le `name` de la fiche
  (`headcoach`, `architect`, …), en lui donnant le BUT du changement et `git diff main...HEAD` ou la liste des
  fichiers. Le verdict revient au format `[@Nom] VISA ACCORDÉ | RENVOYÉ | BLOQUÉ` avec sa grille ; la routine le
  colle dans la description de la PR, section « Visa @Nom ».
- **En session, à la main** : « @HeadCoach, relis la PR #5 » ou « @Nexus point ».
- **Modèle** : `opus` dans chaque fiche (Cyprien veut les directeurs à pleine puissance). Si le quota
  hebdomadaire le réclame, le repli est `sonnet` : changer la ligne `model:` des fiches, rien d'autre.
- Les textes de `ops/direction/routines/` ont été appliqués le 09/11/2026 avec le GO de Cyprien : six routines
  cloud (Direction et Blog sujets ont reçu l'outil Agent, qui leur manquait) et la tâche locale Courrier. Un
  directeur reste « DÉFINI, branché » tant que son premier passage réel n'a pas été lu dans le journal
  (`list_runs`, `get_run_log`) ; il passe « ACTIF (dans …) » ensuite, jamais avant.

## Les 81 numéros + @Vigie

Statuts possibles : `ACTIF` (une routine ou une tâche l'exécute vraiment), `VAGUE 2` (défini, à brancher dans
une routine existante avant avril 2027), `EN ATTENTE` (défini, démarre sur son déclencheur), `APP` (fonction de
l'application, pas un agent), `FUSIONNÉ` (numéro absorbé par un autre agent), `DÉFINI` (direction du 09/11, sous-agent
prêt ; « branché » = texte appliqué à la routine, premier passage à prouver). Les statuts des n°1 à 70 sont ceux de l'index de la section 8 de la constitution
et de `ops/STATE.md`.

| n° | Agent | Pôle | Rend compte à | Statut réel (09/11/2026) | Où il s'exécute |
|---|---|---|---|---|---|
| 1 | @Nexus | Direction | Cyprien Dumez | ACTIF (routine Direction) | routine cloud Direction, vendredi 6 h ; « @Nexus point » en session |
| 2 | @Cortex | A. Direction et amélioration | @Strategos | VAGUE 2 | aucune routine : à brancher dans Direction avant avril 2027 |
| 3 | @Sparring | C. Science du sport et coach | @HeadCoach | ACTIF | routine cloud Coach, lundi 5 h |
| 4 | @PhysioLab | C. Science du sport et coach | @HeadCoach | VAGUE 2 | aucune routine : à brancher dans Coach |
| 5 | @MeteoPacer | C. Science du sport et coach | @HeadCoach | VAGUE 2 | aucune routine : à brancher dans Coach |
| 6 | @Fuel | C. Science du sport et coach | @HeadCoach | VAGUE 2 | aucune routine : à brancher dans Coach |
| 7 | @SafeRun | C. Science du sport et coach | @HeadCoach | ACTIF | routine cloud Coach, lundi 5 h, avec @Sparring |
| 8 | @Sweeper | D. Technique, sécurité, sauvegardes | @Architect | ACTIF | routine cloud Bugs, 6 h et 23 h |
| 9 | @Bunker | D. Technique, sécurité, sauvegardes | @Architect | ACTIF | routine cloud Sécurité et veille, le 5 du mois à 4 h |
| 10 | @Vault | D. Technique, sécurité, sauvegardes | @Architect | ACTIF | routine cloud Sécurité et veille, le 5 du mois à 4 h |
| 11 | @TokenGuard | D. Technique, sécurité, sauvegardes | @Architect | EN ATTENTE (première bêta avec de vrais appels IA) | aucune routine |
| 12 | @Bridge | D. Technique, sécurité, sauvegardes | @Architect | VAGUE 2 | aucune routine : à brancher dans Bugs ou Sécurité et veille |
| 13 | @Chrono | D. Technique, sécurité, sauvegardes | @Architect | VAGUE 2 | aucune routine |
| 14 | @Chaos | D. Technique, sécurité, sauvegardes | @Architect | VAGUE 2 | aucune routine |
| 15 | @Polish | E. Produit, design, mobile | @Maestro | VAGUE 2 | aucune routine |
| 16 | @Funnel | E. Produit, design, mobile | @Maestro | EN ATTENTE (une vingtaine de questionnaires commencés) | aucune routine |
| 17 | @Lab | E. Produit, design, mobile | @Maestro | EN ATTENTE (trafic suffisant pour un test significatif) | aucune routine |
| 18 | @Polyglot | E. Produit, design, mobile | @Maestro | VAGUE 2 | aucune routine : à chaque version, au plus une fois par semaine |
| 19 | @Gazette | E. Produit, design, mobile | @Maestro | EN ATTENTE (bêta ou première version publique) | aucune routine |
| 20 | @Starter | F. Marketing et acquisition | @Mercator | VAGUE 2 | aucune routine ; à la demande en session |
| 21 | @Plume | F. Marketing et acquisition | @Mercator | ACTIF | routines cloud Blog : article le 1er et le 15 à 3 h, sujets le lundi à 3 h 30 |
| 22 | @Programmatic | F. Marketing et acquisition | @Mercator | VAGUE 2 | aucune routine |
| 23 | @Magnet | F. Marketing et acquisition | @Mercator | VAGUE 2 | aucune routine |
| 24 | @Pulse | F. Marketing et acquisition | @Mercator | EN ATTENTE (réseaux sociaux lancés) | aucune routine |
| 25 | @RaceRadar | F. Marketing et acquisition | @Mercator | VAGUE 2 (dès décembre) | aucune routine |
| 26 | @Radar | F. Marketing et acquisition | @Mercator | ACTIF | routine cloud Sécurité et veille, le 5 du mois à 4 h |
| 27 | @Sherpa | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (premières questions de coureurs) | aucune routine |
| 28 | @Relance | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (premiers coureurs inactifs) | aucune routine |
| 29 | @Trophy | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (Strava connecté, premiers coureurs) | aucune routine |
| 30 | @Ambassadeur | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (une cinquantaine de coureurs actifs) | aucune routine |
| 31 | @PacerB2B | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (produit lancé et stable) | aucune routine |
| 32 | @Métronome | H. Finance, administratif, juridique | @Trésorier | EN ATTENTE (premier paiement reçu) | aucune routine |
| 33 | @Percepteur | H. Finance, administratif, juridique | @Trésorier | EN ATTENTE (premiers abonnés payants) | aucune routine |
| 34 | @Greffier | H. Finance, administratif, juridique | @Trésorier | ACTIF | routine cloud Direction, vendredi 6 h |
| 35 | @Alchemist | F. Marketing et acquisition | @Mercator | EN ATTENTE (après le lancement) | aucune routine |
| 36 | @ReviewMiner | F. Marketing et acquisition | @Mercator | EN ATTENTE (après le lancement) | aucune routine |
| 37 | @AdSpy | F. Marketing et acquisition | @Mercator | EN ATTENTE (première publicité) | aucune routine |
| 38 | @ToolBuilder → @Magnet | F. Marketing et acquisition | (fusion) | FUSIONNÉ | — |
| 39 | @BioSync | J. Dans l'application | @Conductor | APP | code de l'application ; à auditer par @Conductor |
| 40 | @MeteoPace | J. Dans l'application | @Conductor | APP | code de l'application ; à auditer par @Conductor |
| 41 | @RacePredictor | I. Données des coureurs | @Oracle | EN ATTENTE (assez de chronos réels enregistrés) | aucune routine |
| 42 | @ShoeTracker | I. Données des coureurs | @Oracle | EN ATTENTE (chaussures enregistrées ; aussi une fonction de l'application à coder) | aucune routine |
| 43 | @StravaGhost → @Trophy | G. Fidélité, support, partenariats | (fusion) | FUSIONNÉ | — |
| 44 | @PaywallLab | H. Finance, administratif, juridique | @Trésorier | EN ATTENTE (assez d'abonnés pour comparer des offres) | aucune routine |
| 45 | @Podcaster | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (assez de coureurs pour une étude fiable) | aucune routine |
| 46 | @PromptEvolver | I. Données des coureurs | @Oracle | EN ATTENTE (retours réels de coureurs sur les fonctions qui parlent) | aucune routine |
| 47 | @ChaosMonkey | D. Technique, sécurité, sauvegardes | @Architect | VAGUE 2 | aucune routine |
| 48 | @TimeMachine | D. Technique, sécurité, sauvegardes | @Architect | ACTIF | tâche locale Sauvegarde chiffrée, Mac de Cyprien, dimanche 11 h |
| 49 | @InjuryShield | J. Dans l'application | @Conductor | APP | code de l'application ; à auditer par @Conductor |
| 50 | @Kinesiologist | J. Dans l'application | @Conductor | APP | code de l'application ; à auditer par @Conductor |
| 51 | @HydratationAI | J. Dans l'application | @Conductor | APP | code de l'application ; à auditer par @Conductor |
| 52 | @StravaHunts | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (produit lancé et stable) | aucune routine |
| 53 | @AffiliateMaster | G. Fidélité, support, partenariats | @Alliance | EN ATTENTE (premiers abonnés payants) | aucune routine |
| 54 | @B2BCoachLink → @PacerB2B | G. Fidélité, support, partenariats | (fusion) | FUSIONNÉ | — |
| 55 | @VoiceCoach | J. Dans l'application | @Conductor | APP | code de l'application ; à auditer par @Conductor |
| 56 | @PromptOptimizer → @PromptEvolver | I. Données des coureurs | (fusion) | FUSIONNÉ | — |
| 57 | @LocaleLocalization → @Polyglot | E. Produit, design, mobile | (fusion) | FUSIONNÉ | — |
| 58 | @TaxWizard | H. Finance, administratif, juridique | @Trésorier | EN ATTENTE (premier paiement reçu) | aucune routine |
| 59 | @LegalWatch | H. Finance, administratif, juridique | @Trésorier | VAGUE 2 | aucune routine : à brancher dans Direction |
| 60 | @RefundBot → @Percepteur | H. Finance, administratif, juridique | (fusion) | FUSIONNÉ | — |
| 61 | @Concierge | B. Secrétariat et e-mails | @Chancelier | ACTIF | tâche locale Courrier, Mac de Cyprien, tous les jours 8 h |
| 62 | @Agenda | B. Secrétariat et e-mails | @Chancelier | VAGUE 2 | aucune routine |
| 63 | @ModelScout | A. Direction et amélioration | @Strategos | VAGUE 2 | aucune routine : à brancher dans Direction |
| 64 | @PostMortem | A. Direction et amélioration | @Strategos | ACTIF | routine cloud Direction, vendredi 6 h, et à chaque erreur constatée |
| 65 | @Deliverability | B. Secrétariat et e-mails | @Chancelier | VAGUE 2 | aucune routine |
| 66 | @AppStoreOps | E. Produit, design, mobile | @Maestro | VAGUE 2 | aucune routine |
| 67 | @FinOpsCloud | D. Technique, sécurité, sauvegardes | @Architect | VAGUE 2 | aucune routine |
| 68 | @DataCleaner | D. Technique, sécurité, sauvegardes | @Architect | EN ATTENTE (premiers vrais inscrits) | aucune routine |
| 69 | @OnboardingCoach | E. Produit, design, mobile | @Maestro | VAGUE 2 | aucune routine |
| 70 | @CrisisManager | A. Direction et amélioration | @Strategos | VAGUE 2 (sur incident) | aucune routine |
| 71 | @Atlas | Direction | @Nexus | DÉFINI, branché le 09/11 dans Direction (premier passage à prouver) | sous-agent `atlas`, routine Direction (vendredi 6 h), juste avant @Nexus |
| 72 | @Strategos | A. Direction et amélioration | @Atlas | DÉFINI, branché le 09/11 dans Direction (premier passage à prouver) | sous-agent `strategos`, routine Direction, avec les leçons de la semaine |
| 73 | @Chancelier | B. Secrétariat et e-mails | @Atlas | DÉFINI, branché le 09/11 dans Courrier (premier passage à prouver) | sous-agent `chancelier`, tâche locale Courrier (Mac, 8 h), après @Concierge |
| 74 | @HeadCoach | C. Science du sport et coach | @Atlas | DÉFINI, branché le 09/11 dans Coach (premier passage à prouver) | sous-agent `headcoach`, routine Coach (lundi 5 h) avant la PR ; à la demande sur toute PR qui touche `src/lib/coach`, `src/lib/ai/autoPlan.ts`, `src/lib/running`, `src/lib/watch` |
| 75 | @Architect | D. Technique, sécurité, sauvegardes | @Atlas | DÉFINI, branché le 09/11 dans Bugs et Sécurité et veille (premier passage à prouver) | sous-agent `architect`, routines Bugs (6 h, 23 h) et Sécurité et veille (le 5) |
| 76 | @Maestro | E. Produit, design, mobile | @Atlas | DÉFINI, s'active avec son pôle (Vague 2) | sous-agent `maestro`, à la demande sur toute PR d'interface, de traduction ou de store |
| 77 | @Mercator | F. Marketing et acquisition | @Atlas | DÉFINI, branché le 09/11 dans Blog et Sécurité et veille (premier passage à prouver) | sous-agent `mercator`, routines Blog (1er/15, lundi) avant la PR, et Sécurité et veille pour le rapport de @Radar |
| 78 | @Alliance | G. Fidélité, support, partenariats | @Atlas | DÉFINI, s'active avec son pôle (en attente) | sous-agent `alliance`, à la demande sur tout brouillon de relance, de partenariat ou de FAQ |
| 79 | @Trésorier | H. Finance, administratif, juridique | @Atlas | DÉFINI, branché le 09/11 dans Direction (premier passage à prouver) | sous-agent `tresorier`, routine Direction, avec les dossiers de @Greffier |
| 80 | @Oracle | I. Données des coureurs | @Atlas | DÉFINI, s'active avec son pôle (en attente) | sous-agent `oracle`, à la demande sur toute analyse de données ou formule de prédiction |
| 81 | @Conductor | J. Dans l'application | @Atlas | DÉFINI, s'active avec la Vague 2 | sous-agent `conductor`, à la demande avant toute PR sur une des six fonctions ; audit de l'existant |
| — | @Vigie | D. Technique, sécurité, sauvegardes | @Architect | ACTIF (GitHub Actions + UptimeRobot, sans IA) | `vigie.yml` (demandé toutes les 30 min, 3 à 4 h réelles) ; UptimeRobot toutes les 5 min |

Contrôle du décompte : 12 actifs + 11 de direction (définis) + 22 en Vague 2 + 24 en attente + 6 fonctions de
l'application + 6 numéros fusionnés = 81 numéros, sans trou, + @Vigie.

## Où chaque directeur s'exécute (aucune routine nouvelle)

| Directeur | Sous-agent | Appelé par | Quand | Texte à ajouter |
|---|---|---|---|---|
| @Nexus (n°1) | `nexus` | routine Direction ; toute session sur « @Nexus point » | vendredi 6 h | `routines/direction.md` |
| @Atlas (n°71) | `atlas` | routine Direction, juste avant @Nexus | vendredi 6 h | `routines/direction.md` |
| @Strategos (n°72) | `strategos` | routine Direction, avec @PostMortem | vendredi 6 h | `routines/direction.md` |
| @Chancelier (n°73) | `chancelier` | tâche LOCALE Courrier, après @Concierge | tous les jours 8 h, Mac | `routines/courrier-local.md` |
| @HeadCoach (n°74) | `headcoach` | routine Coach, avant l'ouverture de la PR | lundi 5 h | `routines/coach.md` |
| @Architect (n°75) | `architect` | routine Bugs avant la PR ; routine Sécurité et veille | 6 h et 23 h ; le 5 à 4 h | `routines/bugs.md`, `routines/securite-et-veille.md` |
| @Maestro (n°76) | `maestro` | à la demande ; rejoindra la routine où son premier agent (Vague 2) sera branché | — | — |
| @Mercator (n°77) | `mercator` | routines Blog avant la PR ; Sécurité et veille pour @Radar | 1er/15 à 3 h, lundi 3 h 30, le 5 | `routines/blog-article.md`, `routines/blog-sujets.md`, `routines/securite-et-veille.md` |
| @Alliance (n°78) | `alliance` | à la demande ; rejoindra la routine de son premier agent actif | — | — |
| @Trésorier (n°79) | `tresorier` | routine Direction, avec @Greffier | vendredi 6 h | `routines/direction.md` |
| @Oracle (n°80) | `oracle` | à la demande ; rejoindra la routine de son premier agent actif | — | — |
| @Conductor (n°81) | `conductor` | à la demande avant toute PR sur une des six fonctions ; audit avec la Vague 2 | — | — |

## Pourquoi pas une routine par directeur

Le brouillon d'origine (09/11/2026) donnait un horaire à chaque directeur, dont trois quotidiens. Or les
routines cloud consomment le quota hebdomadaire de Cyprien et sa limite des 5 heures (8 passages sur 10
refusés en journée les 07 et 08/11) ; la règle 4 du texte et la correction 9 regroupent déjà les agents en six
routines nocturnes. Onze routines de plus auraient étouffé celles qui travaillent. Un directeur qui relit dans
le passage de son agent coûte un appel de sous-agent quand il y a une PR, et rien sinon.

## Les 6 fusions

38 @ToolBuilder → 23 @Magnet · 43 @StravaGhost → 29 @Trophy · 54 @B2BCoachLink → 31 @PacerB2B ·
56 @PromptOptimizer → 46 @PromptEvolver · 57 @LocaleLocalization → 18 @Polyglot · 60 @RefundBot → 33 @Percepteur.

## Documents hors dépôt

- Organigramme PDF : `~/Desktop/Pacevo/structure de l'entreprise/organigramme-agents-pacevo.pdf`, régénéré par
  `organigramme-agents-pacevo.py` dans le même dossier.
- Prompt d'origine de cette direction (relu et corrigé) :
  `~/Desktop/Pacevo/structure de l'entreprise/prompt-claude-code-direction-agents-v2.md`.

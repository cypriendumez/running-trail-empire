# `@Greffier` : check-list des accès aux API de montres

*Sources vérifiées le 08/11/2026, puis revues le 13/11/2026 (Garmin, Suunto et Strava relus ; Polar : accord de licence relu par mots-clés le 16/11/2026, pas en entier ; COROS non revérifié le 13/11/2026 (réseau : HTTP 403)). À revérifier avant chaque envoi :
les programmes changent souvent.*

## Le point de départ

Aujourd'hui **toutes** les séances et données de montre passent par **intervals.icu** (OAuth,
application n° 1331). Les séances arrivent déjà au poignet chez Garmin, COROS, Suunto, Wahoo,
Amazfit et Huawei par ce chemin. Une API directe est un plus (connexion sans compte tiers), pas
une condition du lancement. Les conditions d'intervals.icu autorisent l'usage commercial.

## Ce qu'il faut avant toute demande (bloquant partout)

- [ ] **Entreprise immatriculée** : SIREN, raison sociale. Tous les programmes sont « professionnels ». Le début d'activité est prévu le 1er avril 2027 (dépôt au guichet à partir du 1er mars 2027) : la plupart des dossiers ne partent qu'après.
- [x] Adresse pro `contact@pacevo.fr` qui reçoit vraiment : redirigée vers Outlook et vers la boîte de `@Concierge`, prouvé le 08/11/2026.
- [ ] Politique de confidentialité à jour qui nomme chaque marque comme source de données (`/confidentialite`, 5 langues).
- [ ] Une page « comment Pacevo utilise vos données de montre » et une adresse de redirection OAuth par marque (`https://pacevo.fr/api/<marque>/oauth/callback`).

## Marque par marque

| Marque | État du programme | Démarche | Condition connue | Priorité |
|---|---|---|---|---|
| **Garmin** (Connect Developer Program, Training API) | **Changement constaté le 13/11/2026** : la page officielle (https://developer.garmin.com/gc-developer-program/overview/) ne parle plus de suspension et présente un accès « Starter » (Activity, Courses, Health, Training, Women's Health ; livraison en push seulement ; pas d'historique ; capacité d'utilisateurs limitée) puis « Enterprise » sur demande. Un bouton « REQUEST NOW » existe. La reprise des demandes n'est pas confirmée par un texte daté : à vérifier avec le formulaire au moment du SIREN | Ancienne démarche : formulaire « Contact Us » de developer.garmin.com (liste d'attente). Le 13/11/2026 la page décrit un bouton « REQUEST NOW » (accès Starter) ; rien n'est demandé avant le SIREN. E-mail rédigé : `~/Desktop/Pacevo/Pacevo-Garmin-Demande.md` | Professionnel ; gratuité de l'accès Starter non revérifiée le 13/11/2026 (à revérifier) ; règles d'usage des données avec une IA : non trouvées le 13/11/2026 | Cyprien envoie la demande dès le SIREN obtenu (Niveau 3) |
| **COROS** (Partner API) | Ouvert, processus « standardisé » | Formulaire en ligne + e-mail à `api@coros.com` (société, contacts techniques, URI OAuth) — https://support.coros.com/hc/en-us/articles/17085887816340 | Règles d'usage avec une IA : non revérifiées le 13/11/2026 (réseau). « Plateformes avec une base d'utilisateurs établie ». Un témoignage (Reddit, non officiel) parle de 25 000 actifs/mois. Alternative sans dossier : « Build on COROS MCP » (self-service) | Après lancement, quand le nombre d'utilisateurs se défend |
| **Suunto** (Cloud API, programme partenaires) | Ouvert, gratuit ; règles d'usage des données avec une IA : non trouvées le 13/11/2026 | Formulaire « Become a Suunto partner » en cochant Suunto Cloud API — https://apizone.suunto.com/ | Accord d'API à signer (Niveau 3 : Cyprien signe) | Dès le SIREN (page apizone.suunto.com relue le 13/11/2026 : programme partenaires et accord d'API à accepter à la demande, inchangé) |
| **Polar** (AccessLink) | Ouvert à tout titulaire d'un compte Polar Flow, mais créer un client vaut acceptation de l'« API Limited License Agreement » de Polar (https://www.polar.com/en/legal/polar-api-agreement, relu par mots-clés le 16/11/2026) : c'est un contrat (Niveau 3) | Créer un client sur https://admin.polaraccesslink.com avec un compte Polar Flow (documentation : https://www.polar.com/accesslink-api/) : Cyprien seul, après lecture de l'accord | Règles d'usage avec une IA : aucune mention de l'IA ni de l'apprentissage automatique trouvée dans l'accord le 16/11/2026 (recherche par mots-clés, accord non relu en entier : à relire avant toute demande). Lecture des séances ; l'envoi de séances structurées est à vérifier (la documentation relue le 16/11/2026 est la v3) | Après relecture de l'accord ; création du client par Cyprien |
| **Apple Watch** (HealthKit) | Pas d'API serveur | Lecture uniquement depuis l'appli iPhone native (coquille Capacitor `appli/`) avec un plugin HealthKit, et la mention de confidentialité santé de l'App Store | Revue Apple ; données santé = déclaration détaillée | Avec la sortie de l'appli iPhone |
| **Strava** | API ouverte, mais accord restrictif | https://www.strava.com/legal/api et https://www.strava.com/legal/api_policy | **Interdiction CONFIRMÉE le 13/11/2026** : l'API Policy 2026 (en vigueur au 01/06/2026, intégrée à l'accord 2026) interdit d'utiliser les données Strava, directement ou indirectement, pour le développement, l'entraînement, l'évaluation ou le fonctionnement de toute « AI Application », y compris les données dérivées ou agrégées et l'ingestion dans une fenêtre de contexte (section 5.3 de l'API Policy, relue le 13/11/2026 et le 16/11/2026). La section 5.4 interdit en outre tout traitement des données Strava, même agrégées ou anonymisées, à des fins d'analyse ou d'amélioration du produit, et toute combinaison avec d'autres données de clients. L'accord seul ne contient pas ces mots : la règle est dans la Policy. Aucune donnée Strava dans le coach ni dans Gemini ; reste à instruire : une séance venue de Strava et relayée par intervals.icu peut-elle atteindre Gemini ? | Plateforme sociale seulement (partage, Garde-fou 10) |

## Prochaines actions

1. Cyprien : SIREN (dépôt le 1er mars 2027, début d'activité le 1er avril 2027) → débloque Garmin et Suunto.
2. `@Greffier` : préparer dans `~/Desktop/Pacevo/admin/` le dossier Polar AccessLink : résumé de l'accord de licence (https://www.polar.com/en/legal/polar-api-agreement), champs du formulaire, ce que l'API permet (lecture / envoi de séances). La création du client vaut acceptation de cet accord : Cyprien seul la fait (Niveau 3), après son GO.
3. `@Greffier` : relire l'accord Strava en entier et écrire ce qui reste permis à Pacevo (afficher, partager) avant toute intégration.

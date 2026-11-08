# `@Greffier` : check-list des accès aux API de montres

*Sources vérifiées le 08/11/2026 (lien après chaque ligne). À revérifier avant chaque envoi :
les programmes changent souvent.*

## Le point de départ

Aujourd'hui **toutes** les séances et données de montre passent par **intervals.icu** (OAuth,
application n° 1331). Les séances arrivent déjà au poignet chez Garmin, COROS, Suunto, Wahoo,
Amazfit et Huawei par ce chemin. Une API directe est un plus (connexion sans compte tiers), pas
une condition du lancement. Les conditions d'intervals.icu autorisent l'usage commercial.

## Ce qu'il faut avant toute demande (bloquant partout)

- [ ] **Entreprise immatriculée** : SIREN, raison sociale. Tous les programmes sont « professionnels ». Le début d'activité est prévu le 01/01/2027 : la plupart des dossiers ne partent qu'après.
- [ ] Adresse pro `contact@pacevo.fr` qui reçoit vraiment (tester un envoi).
- [ ] Politique de confidentialité à jour qui nomme chaque marque comme source de données (`/confidentialite`, 5 langues).
- [ ] Une page « comment Pacevo utilise vos données de montre » et une adresse de redirection OAuth par marque (`https://pacevo.fr/api/<marque>/oauth/callback`).

## Marque par marque

| Marque | État du programme | Démarche | Condition connue | Priorité |
|---|---|---|---|---|
| **Garmin** (Connect Developer Program, Training API) | **Demandes nouvelles SUSPENDUES depuis mai 2026**, sans date de reprise | Formulaire « Contact Us » de developer.garmin.com pour la liste d'attente. E-mail rédigé : `~/Desktop/Pacevo/Pacevo-Garmin-Demande.md` | Professionnel, gratuit | Envoyer dès le SIREN obtenu |
| **COROS** (Partner API) | Ouvert, processus « standardisé » | Formulaire en ligne + e-mail à `api@coros.com` (société, contacts techniques, URI OAuth) — https://support.coros.com/hc/en-us/articles/17085887816340 | « Plateformes avec une base d'utilisateurs établie ». Un témoignage (Reddit, non officiel) parle de 25 000 actifs/mois. Alternative sans dossier : « Build on COROS MCP » (self-service) | Après lancement, quand le nombre d'utilisateurs se défend |
| **Suunto** (Cloud API, programme partenaires) | Ouvert, gratuit | Formulaire « Become a Suunto partner » en cochant Suunto Cloud API — https://apizone.suunto.com/ | Accord d'API à signer (Niveau 3 : Cyprien signe) | Dès le SIREN |
| **Polar** (AccessLink) | Ouvert, en libre-service | Créer un client sur https://admin.polaraccesslink.com avec un compte Polar Flow | Lecture des séances ; l'envoi de séances structurées est à vérifier dans la doc v4 | Possible tout de suite (test) |
| **Apple Watch** (HealthKit) | Pas d'API serveur | Lecture uniquement depuis l'appli iPhone native (coquille Capacitor `appli/`) avec un plugin HealthKit, et la mention de confidentialité santé de l'App Store | Revue Apple ; données santé = déclaration détaillée | Avec la sortie de l'appli iPhone |
| **Strava** | API ouverte, mais accord restrictif | https://www.strava.com/legal/api | **L'accord interdit d'utiliser les données obtenues par l'API Strava dans des modèles d'IA ou d'apprentissage automatique** (mise à jour de novembre 2024). Pacevo ne doit donc PAS faire entrer de données Strava dans son coach ni dans Gemini | Plateforme sociale seulement (partage, Garde-fou 10) |

## Prochaines actions

1. Cyprien : SIREN (début d'activité au 01/01/2027) → débloque Garmin et Suunto.
2. `@Greffier` : créer un client Polar AccessLink de test (aucun coût, aucune signature) et noter précisément ce que l'API permet (lecture / envoi de séances).
3. `@Greffier` : relire l'accord Strava en entier et écrire ce qui reste permis à Pacevo (afficher, partager) avant toute intégration.

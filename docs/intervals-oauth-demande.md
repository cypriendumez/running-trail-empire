# Demande d'accès OAuth à intervals.icu (11/10/2026)

> **✅ APPROUVÉE le 12/10/2026** (notification « Le statut de votre application OAuth 1331 Pacevo est
> APPROUVÉ, recherchez-la dans /settings/apps »). Le code est écrit le même jour (voir la fin du
> document) ; il reste à poser l'identifiant et le secret dans l'environnement, puis à déployer.

À remplir par Cyprien, connecté à son compte intervals.icu : https://intervals.icu/oauth/apply
L'application reste « Pending » jusqu'à approbation ; ensuite la page de gestion donne le
client_id et le client_secret (à mettre dans Vercel, jamais dans le code).

## Champs du formulaire (relevés sur l'écran de Cyprien le 11/10/2026)

| Champ | Valeur |
|---|---|
| Nom | Pacevo |
| Description | le texte court ci-dessous : **250 caractères au plus** (espaces compris) |
| Site Internet | https://pacevo.fr |
| Politique de confidentialité | https://pacevo.fr/confidentialite (cite intervals.icu en 5 langues) |
| Plateformes | Application web |
| Catégories | Entraînements, Analyse (pas « Coach IA » : le plan est calculé par des règles, l'IA relit) |
| Redirect URLs | https://pacevo.fr/api/intervals/oauth/callback (`http://localhost/*` est toujours autorisé) |
| Webhooks, Activity URL Template | vides pour l'instant |

Le formulaire ne demande **ni logo, ni portées, ni Athlete ID** : l'appli est rattachée au compte
connecté (le 11/10, le compte intervals.icu « running appli »), le logo se met ensuite sur la page
de gestion, et les portées se demandent dans l'URL d'autorisation.

Portées relevées dans le code le 11/10/2026 : lecture des activités, flux, intervalles et
courbes d'allure (ACTIVITY) ; lecture du bien-être (WELLNESS) ; écriture et suppression des
séances planifiées (CALENDAR:WRITE, `events`) ; réglage de l'allure seuil s'il est vide
(SETTINGS:WRITE, `sport-settings`). WRITE implique READ. Elles sont expliquées à David dans le mail.

## Description courte (celle du formulaire, 218 caractères)

Pacevo is an adaptive running and trail coach. It reads your activities, HRV and sleep to build a 7-day training plan, updated after every sync, and sends the workouts to your watch through your intervals.icu calendar.

## Description longue (1 332 caractères : trop longue pour le formulaire, reprise dans le mail)

Pacevo is an adaptive running and trail-running coach, available as a web app at pacevo.fr in
French, English, German, Spanish and Portuguese. It builds a rolling 7-day training plan from
each athlete's own data and re-plans after every sync, taking into account training load, heart
rate, HRV, sleep, injuries and the athlete's race goal.

We would use the intervals.icu API as follows:
- ACTIVITY:READ: completed activities, streams and intervals, to compute training load, pace and
  heart-rate zones, and VO2max estimates.
- WELLNESS:READ: HRV, resting heart rate and sleep, to adjust the intensity of upcoming sessions.
- CALENDAR:WRITE: to add our planned workouts to the athlete's intervals.icu calendar so they sync
  to their watch, and to remove the ones we replace.
- SETTINGS:WRITE: only to set the running threshold pace when it is empty, so that pace targets
  export correctly to the watch.

Each athlete's data is shown only to that athlete. It is never sold or shared, and the athlete
can disconnect at any time. Every data view displays "Charts may include data from Garmin
devices", as required by your API terms. Pacevo will offer paid plans, which your API terms allow.

Today our athletes connect by pasting their personal API key and athlete ID. OAuth would replace
that step with a single, revocable authorisation.

## Si le formulaire propose un champ de message libre

Hi David, I'm Cyprien, the developer of Pacevo (pacevo.fr). We already use the intervals.icu API
with personal API keys, and you kindly answered my questions about attribution in August. I'd like
to switch to OAuth so that athletes no longer have to copy their API key. Thank you for considering
the application!

## ⚠️ Garmin : blocage probable des données par l'API (annonce du 09/10/2026)

Encadré bleu affiché sur le formulaire, et David sur le forum
(https://forum.intervals.icu/t/api-access-to-intervals-icu/609/752) : Garmin a mis à jour ses
conditions, et intervals.icu devra « probablement bientôt » bloquer l'accès aux données Garmin
par l'API. Le soir même (#788), appel avec Garmin, discussions en cours. Au 11/10, **rien de
confirmé** : ni la date, ni les données touchées (activités ? VFC, sommeil ?), ni si les clés
personnelles sont visées comme les applis OAuth, ni l'envoi des séances planifiées vers la montre.
Seule précision (#759) : les fichiers FIT importés par l'athlète lui-même sont « probablement OK ».
Les autres marques (COROS, Suunto, Polar, Wahoo, Apple via Intervals Companion) ne sont pas
concernées. Pour Pacevo : si le blocage tombe, les coureurs Garmin ne remonteraient plus.

## Les alertes (webhooks de l'application) — code prêt le 16/10/2026

- **Format réel** (guide d'intégration, forum.intervals.icu, sujet 80090) :
  `{ "secret": "…", "events": [{ "athlete_id", "type", "timestamp", "activity": {…} }] }`. Le secret
  voyage dans le CORPS : c'est le champ « Webhook Secret » de Manage App, comparé à
  `INTERVALS_WEBHOOK_SECRET`. L'ancienne route l'attendait dans `?secret=` et lisait `athlete_id` à la
  racine : elle n'aurait jamais accepté une seule alerte réelle.
- **Une réponse hors 2xx est renvoyée** pendant un temps, à intervalles croissants (David, message 20 du
  même sujet). La route ne répond donc une erreur (503) que si réessayer peut réussir : intervals.icu
  débordé (429) ou en panne (5xx), coupure réseau, base injoignable, secret pas encore posé. Un compte
  inconnu, une autorisation retirée (journalisée dans /admin › Bugs) ou un type non traité sont acquittés.
- **Ce qui synchronise** : `ACTIVITY_UPLOADED`, `ACTIVITY_ANALYZED` (envoyée 60 s après, analyses
  regroupées), `ACTIVITY_UPDATED`, `WELLNESS_UPDATED`. **Pas `CALENDAR_UPDATED`** : chaque envoi de séances
  vers la montre écrit le calendrier, qui émettrait l'alerte — boucle. `ACTIVITY_DELETED` est acquittée
  sans effacer notre copie (le ressenti, la trace et les segments partiraient avec : à concevoir à part).
- **Comment** : `src/lib/intervals/webhook.ts` (lecture, secret à temps constant, une synchro par athlète,
  fenêtre qui couvre la séance annoncée) ; la route synchronise par la chaîne partagée
  (`synchroniser`), répond, puis importe les traces et replanifie APRÈS la réponse (`after`).
- **Limites** : aucune alerte pour une séance venue de Strava, ni pour un athlète relié par clé API — le
  sondage (AutoSync) et le balayage restent.
- **Tests** : `tests/intervals-webhook.test.ts` (20) et 12 cas sur la vraie route dans
  `tests/synchro.crash.test.ts` ; 18 mutations, toutes détectées.

## ✅ Annuaire public : fait (16/10/2026)

David a répondu « Done! » le 16/10 au mail de Cyprien : Pacevo figure dans l'annuaire public des
applications d'intervals.icu. Rien à répondre.

## Après l'approbation : ce qui est fait (12/10/2026)

- **En-tête commun** : `src/lib/intervals/auth.ts` (`enteteIntervals`). Il était recopié à la main dans
  **16 fichiers** (et pas 8) ; une clé part en `Basic API_KEY:…`, un jeton en `Bearer …`.
- **Aucune migration** : le jeton est rangé dans `profiles.intervals_api_key`, préfixé `oauth:`. La colonne
  est déjà retirée de tout profil envoyé au navigateur (`stripProfileSecrets`).
- **Le protocole** : `src/lib/intervals/oauth.ts`. Routes `/api/intervals/oauth/start` (state dans un
  cookie httpOnly, `SameSite=Lax`, 10 min) et `/api/intervals/oauth/callback` (state vérifié AVANT
  l'échange, cookie effacé à chaque sortie, retour vers une page fixe, portées accordées relues).
- **Déconnexion** : révocation par `DELETE /api/v1/disconnect-app` ; une clé collée à la place d'une
  autorisation révoque aussi l'ancienne autorisation.
- **Écrans** : bouton « Autoriser Pacevo » à l'étape Montre du questionnaire (les réponses sont
  enregistrées AVANT de partir : elles n'existent qu'en mémoire) et sur Sync Montre ; bandeau de
  retour (ok, portées manquantes, refus, expiré, erreur). La clé reste proposée, repliée. Le bouton
  n'apparaît que si `/api/intervals/status` répond `oauth: true`, c'est-à-dire si les deux variables
  existent sur le serveur.
- **Tests** : `tests/intervals-oauth.test.ts` (20 tests, 10 mutations toutes détectées).

## ✅ Secret changé, vérifié, et mail d'annuaire envoyé (16/10/2026)

- Secret de l'application changé (il avait été visible dans une conversation), VÉRIFIÉ auprès d'intervals.icu
  avant d'être posé dans Vercel, production remise en ligne ; nouvel essai réussi (bandeau vert, 16/10 matin).
- Diagnostic utile : `POST /api/oauth/token` répond 404 « Client and/or secret not found » quand le couple
  identifiant/secret est faux — c'était l'échec du 16/10 à 8 h 58.
- Mail envoyé par Cyprien à support@intervals.icu le 16/10 pour figurer dans l'annuaire public des applications
  (accepté le jour même, voir plus haut).

## ✅ Activée et essayée le 15/10/2026 à 21 h 14

Déploiement `9913ad8` avec les deux variables ; adresse de retour ajoutée par Cyprien sur « Manage App ».
Essai réel : départ 21:13:54, retour 21:14:30 (303), puis synchro 200. En base, le profil de Cyprien
(`i564686`) porte un jeton `oauth:` ; vérifié en lecture seule avec ce jeton : compte 200, activités 200,
bien-être 200, calendrier 200. Aucune ligne au journal d'erreurs.

## État au 15/10/2026

- Le code OAuth est **en production** depuis le 15/10 (déploiement `1dd3aa0`, fait par une autre session depuis
  la branche qui avait intégré main) : `/api/intervals/oauth/start` et `/callback` répondent sur pacevo.fr.
- `INTERVALS_OAUTH_CLIENT_ID` = **1331**, posé dans Vercel (Production) le 15/10 : ce n'est pas un secret.
- `INTERVALS_OAUTH_CLIENT_SECRET` : à coller par Cyprien (onglet Terminal « Secret OAuth », commande
  `vercel env add INTERVALS_OAUTH_CLIENT_SECRET production --sensitive --yes`).
- ⚠️ Une variable Vercel ne s'applique qu'au déploiement SUIVANT : après le secret, relancer une mise en ligne
  (`vercel redeploy` de la production, ou `npm run deploie`), sinon le bouton reste caché.
- ⚠️ Le bouton « Exécuter » de l'app ne sait pas répondre aux questions d'une commande : `vercel env add` sans
  `--value` y reste bloquée sur « Is the value a sensitive secret? ». Pour une valeur publique, passer
  `--value … --non-interactive` ; pour un secret, la taper dans un onglet Terminal.

## Le mail pour l'annuaire public (à envoyer par Cyprien APRÈS un essai réussi)

À : support@intervals.icu · Objet : Pacevo (OAuth app #1331) — listing in the app directory

> Hi David,
>
> Thank you for approving our OAuth application (Pacevo, app #1331). The integration is now live on
> https://pacevo.fr: athletes authorise Pacevo in one click (ACTIVITY:READ, WELLNESS:READ, CALENDAR:WRITE,
> SETTINGS:WRITE). We exchange the code server-side, check which scopes were actually granted, and revoke
> the token with /api/v1/disconnect-app when an athlete disconnects. I have tested the full flow with my
> own account.
>
> Could you list Pacevo in the public app directory? Management page: [lien copié depuis la page « Manage App »]
> Website: https://pacevo.fr · Privacy policy: https://pacevo.fr/confidentialite
>
> Thanks again,
> Cyprien — Pacevo

## Ce qui reste à faire

La connexion OAuth est **terminée** : approuvée le 12/10, en production le 15/10, secret changé et
vérifié le 16/10, inscrite à l'annuaire le 16/10.

Les **alertes** sont EN SERVICE depuis le 16/10/2026 (déploiement `4739336`, ~20 h 35) :
- ⚠️ Le champ « Webhook Secret » de Manage App **ne se modifie pas** : intervals.icu fixe lui-même le code
  (11 caractères). Notre code fabriqué n'a donc pas pu y être collé ; c'est LE SIEN qui a été copié par Cyprien
  et posé dans Vercel (`INTERVALS_WEBHOOK_SECRET`, Production, sensible) par un script qui le lit sans l'afficher.
  Il a été visible sur des captures : risque faible (au pire, une synchronisation de plus, aucune donnée lue).
- Webhook URL `https://pacevo.fr/api/webhooks/intervals` ; cochés `ACTIVITY_UPLOADED`, `ACTIVITY_ANALYZED`,
  `ACTIVITY_UPDATED`, `WELLNESS_UPDATED` ; PAS `CALENDAR_UPDATED`.
- **Essai** : bouton « Envoyer le webhook de test » → `POST /api/webhooks/intervals` à 20:42:02, réponse **200**
  (secret reconnu : sinon 401 ; format lu : sinon 400), aucune ligne dans `error_logs`.
- Pour vérifier plus tard : `vercel logs --no-branch --environment production --since 1h --json` (filtrer sur
  `/api/webhooks/intervals`) ; un secret désaccordé se lit dans /admin › Bugs.

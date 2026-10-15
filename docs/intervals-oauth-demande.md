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

## Webhooks (plus tard)

L'appli OAuth donne accès aux webhooks : `ACTIVITY_UPLOADED`, `WELLNESS_UPDATED`,
`CALENDAR_UPDATED` (pas `CALENDAR_EVENT_*`, dépréciés) pourraient déclencher la replanification
à l'arrivée d'une séance, au lieu des tâches planifiées étranglées. Les webhooks d'activité ne
partent pas pour les activités Strava. URL en https, réglable sur la page de gestion.

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

1. **Cyprien** — sur https://intervals.icu/settings/apps › Pacevo › « Manage App » :
   - relever le **Client ID** et le **Client Secret** ;
   - vérifier l'adresse de retour : `https://pacevo.fr/api/intervals/oauth/callback` ;
   - déposer le logo (`public/icon-master-1024.png`).
2. **Cyprien** — poser les deux variables dans Vercel (Production), lui-même : le secret ne passe
   jamais par la conversation.
   - `INTERVALS_OAUTH_CLIENT_ID`
   - `INTERVALS_OAUTH_CLIENT_SECRET`
   Et dans `.env.local` pour essayer en local (`http://localhost/*` est toujours autorisé).
3. **Déployer** (avec l'accord de Cyprien), puis essayer « Autoriser Pacevo » sur Sync Montre avec le
   compte de Cyprien : bandeau vert, première synchro, séance poussée sur la montre.
4. **Annuaire public** : une fois testé, écrire à support@intervals.icu avec le lien de la page de
   gestion pour figurer dans la liste des applications (exigé par la documentation).
5. **Webhooks de l'application** (plus tard) : une seule adresse pour tous les athlètes, réglée sur la
   page de gestion ; `/api/webhooks/intervals` lit encore l'ancien format et doit être réécrit avant
   (voir aussi la branche non fusionnée du 12/10 qui touche cette route).

# Demande d'accès OAuth à intervals.icu (11/10/2026)

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

## Après l'approbation (à faire côté code)

1. Variables Vercel : `INTERVALS_OAUTH_CLIENT_ID`, `INTERVALS_OAUTH_CLIENT_SECRET`, saisies par
   Cyprien lui-même (le secret ne passe jamais par la conversation).
2. Bouton « Connecter intervals.icu » → `https://intervals.icu/oauth/authorize?client_id=…&redirect_uri=…&scope=…&state=…`.
3. Route `/api/intervals/oauth/callback` : échange du code en moins de 2 minutes sur
   `POST https://intervals.icu/api/oauth/token` ; la réponse donne le jeton et l'Athlete ID.
4. Un en-tête d'authentification commun : le code fait aujourd'hui `Basic API_KEY:<clé>` à 8 endroits ;
   avec OAuth, `Bearer <jeton>`. Garder la clé API comme repli.

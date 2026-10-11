# Demande d'accès OAuth à intervals.icu (11/10/2026)

À remplir par Cyprien, connecté à son compte intervals.icu : https://intervals.icu/oauth/apply
L'application reste « Pending » jusqu'à approbation ; ensuite la page de gestion donne le
client_id et le client_secret (à mettre dans Vercel, jamais dans le code).

## Champs du formulaire

| Champ | Valeur |
|---|---|
| Application name | Pacevo |
| Website | https://pacevo.fr |
| Logo | https://pacevo.fr/icon-master-1024.png (carré, 1024 px, en ligne) |
| Privacy policy | https://pacevo.fr/confidentialite (cite intervals.icu en 5 langues) |
| Redirect URIs | https://pacevo.fr/api/intervals/oauth/callback et http://localhost:3000/api/intervals/oauth/callback |
| Scopes | ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:WRITE |
| Intervals.icu ID | l'Athlete ID de Cyprien (commence par « i ») |

Portées relevées dans le code le 11/10/2026 : lecture des activités, flux, intervalles et
courbes d'allure (ACTIVITY) ; lecture du bien-être (WELLNESS) ; écriture et suppression des
séances planifiées (CALENDAR:WRITE, `events`) ; réglage de l'allure seuil s'il est vide
(SETTINGS:WRITE, `sport-settings`). WRITE implique READ.

## Description (à coller telle quelle)

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

## Après l'approbation (à faire côté code)

1. Variables Vercel : `INTERVALS_OAUTH_CLIENT_ID`, `INTERVALS_OAUTH_CLIENT_SECRET`.
2. Bouton « Connecter intervals.icu » → `https://intervals.icu/oauth/authorize?client_id=…&redirect_uri=…&scope=…&state=…`.
3. Route `/api/intervals/oauth/callback` : échange du code en moins de 2 minutes sur
   `POST https://intervals.icu/api/oauth/token` ; la réponse donne le jeton et l'Athlete ID.
4. Un en-tête d'authentification commun : le code fait aujourd'hui `Basic API_KEY:<clé>` à 8 endroits ;
   avec OAuth, `Bearer <jeton>`. Garder la clé API comme repli.

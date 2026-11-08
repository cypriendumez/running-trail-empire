# Leçons apprises (tenu par `@PostMortem`)

Format : `[Date] [@Agent] Erreur commise -> Cause racine -> Nouvelle règle absolue`.
Chaque agent lit ce fichier AVANT d'agir. Le dépôt est public : aucune donnée personnelle ici.

Amorcé le 08/11/2026 avec les défauts réellement constatés sur Pacevo (source : `CLAUDE.md`,
mémoire de projet). Les règles du `CLAUDE.md` racine restent prioritaires.

## Production et déploiement

- [2026-09] [@Tous] Un correctif poussé sur `main` est resté hors production -> `git push` ne déploie rien (Vercel n'est pas relié à GitHub) -> Ne jamais annoncer « en ligne » sans `npm run enligne` ; déployer = `/deployer`, avec l'accord explicite de Cyprien.
- [2026-10] [@Tous] `vercel deploy` a embarqué des fichiers non suivis -> Vercel téléverse le DISQUE, pas git -> Jamais de déploiement depuis un arbre modifié ou quand une autre session travaille dans le dépôt.

## Base de données

- [2026-09] [@Vault] Un fichier `supabase/migrations/NNN_*.sql` ne prouvait pas que la table existait -> le schéma s'applique à la main -> Vérifier le schéma réel en lecture seule avant toute conclusion ; un changement = du SQL donné à Cyprien.
- [2026-09-14] [@Vault] 100 % des inscrits voyaient « Erreur lors de la sauvegarde » -> table avec RLS mais sans politique : refus silencieux -> Toute table écrite depuis le navigateur a une `create policy` (test `tests/bugs-visites.test.ts`).
- [2026-09] [@Tous] Des écritures échouaient sans bruit -> Supabase RETOURNE `{ error }` au lieu de lever -> Toute écriture lit son `error` ; un `try/catch` seul ne rattrape rien.
- [2026-11-07] [@Tous] Le garde-fou refuse un SQL à plusieurs instructions -> `garde-supabase.mjs` force une instruction par appel, en READ ONLY -> Une requête par appel, sans `begin`/`commit` sur le Mac (le hook les ajoute) ; dans le cloud, `begin transaction read only; …; commit;` est obligatoire.

## Journal d'erreurs (`@Sweeper`)

- [2026-11-06] [@Sweeper] Le journal se remplissait d'erreurs `localhost` des postes de dev -> rien ne filtrait à l'écriture -> `rapportLocal` filtre à l'entrée de `/api/log-error` et `/api/csp-report` ; `estBruitDeDev` masque l'ancien bruit. Vérifié le 08/11 : zéro ligne locale depuis. Ne pas « re-corriger ».
- [2026-11-07] [@Sweeper] 36 rapports CSP comptés comme bugs venaient d'extensions de navigateur -> le script d'une extension charge ses ressources dans nos pages -> `rapportEtranger` les écarte ; une extension n'est jamais un défaut Pacevo.
- [2026-10-12] [@Sweeper] Un filtre « url non-http = scan » cachait TOUTES les lignes écrites par le serveur -> le serveur signe ses lignes `/api/…` ou `lib/…` -> Tout nouveau filtre de bruit se teste sur une ligne serveur réelle avant d'être livré.

## Coach (`@Sparring`, `@SafeRun`)

- [2026-09-07] [@Sparring] Le coach n'était validé que sur le profil de Cyprien -> tous les tests partaient du même contexte -> Tester chaque règle sur plusieurs archétypes (`tests/profils.crash.test.ts`).
- [2026-09-07] [@Sparring] Un test « aucune séance dure » passait sur une liste vide -> fixture tautologique -> Toujours tendre de vrais candidats au code testé ; une assertion n'est acquise que si une mutation la fait rougir.
- [2026-11-05] [@Sparring] 14 km visés pour un coureur à 70 km/sem, affûtage de 3 semaines pour un 5 km -> défauts visibles seulement sur des données réelles après une course et un silence de montre -> Rejouer les plans en lecture seule sur des situations réelles (après course, montre muette, reprise), pas seulement des profils propres.
- [2026-11-05] [@Sparring] Un plan a parfois 2 séances le même jour -> `plan[i]` n'est pas le jour i -> Toujours lire le plan par date et créneau.
- [Constant] [@Sparring] Une VMA ou une FC max codée en dur s'affichait comme une mesure -> valeur par défaut présentée comme donnée -> Quand la donnée manque, on le dit ; jamais de chiffre plausible inventé.

## Routines et outils

- [2026-11-07] [@Plume] Trois passages du blog ont échoué en quelques secondes -> quota hebdomadaire de Cyprien épuisé (routines et sessions partagent le même quota) -> Un passage de moins de 30 s est suspect : lire `RemoteTrigger list_runs` puis `get_run_log` avant de conclure.
- [2026-09-21] [@Plume] La routine ne pouvait pas vérifier ses sources -> l'environnement cloud refuse par défaut les domaines hors liste -> Avant de planifier un agent qui lit le web, vérifier que ses domaines sont autorisés dans l'environnement « Default ».
- [2026-11-08] [@Nexus] La constitution prévoyait `ops/mails`, `ops/compta`, `ops/admin` dans le dépôt -> le dépôt est PUBLIC -> Aucune donnée personnelle, comptable ou administrative dans git ; ces dossiers vivent dans `~/Desktop/Pacevo/` (ignorés par `.gitignore`).
- [2026-11-08] [@Nexus] La constitution demandait d'écraser `CLAUDE.md` -> ce fichier porte les règles techniques nées des défauts réels -> On n'écrase jamais `CLAUDE.md` ; la constitution vit dans `ops/CONSTITUTION.md`, `CLAUDE.md` y renvoie.

## Leçons du 08/11/2026

- [2026-11-08] [@Sweeper] 8 passages sur 10 refusés en 12 s alors que la limite hebdomadaire était à 2 % -> les routines partagent la limite des 5 heures avec les sessions de Cyprien -> Les routines tournent la nuit ; un passage de moins de 30 s est un refus, à lire avec `list_runs` puis `get_run_log`.
- [2026-11-08] [@Nexus] `get_run_log` coupait la sortie juste avant la réponse attendue -> le journal condensé tronque les sorties longues -> Pour prouver un résultat, faire imprimer la donnée en PREMIER ou lire la session complète sur claude.ai.
- [2026-11-08] [@Plume] L'article de la PR #3 portait la date du jour où la routine l'avait écrit (01/10), pas celle de sa mise en ligne -> la routine date l'article à l'écriture -> À la fusion, recaler `maj` sur la date de mise en ligne.
- [2026-11-08] [@Plume] Une nuance demandée par Cyprien (blessures « liées à l'allure » chez Nielsen 2014) n'était pas dans le résumé PubMed -> le résumé ne dit pas tout -> Vérifier une nuance dans le texte intégral avant de l'écrire, jamais de mémoire.
- [2026-11-08] [@Bunker] La construction a échoué dans le worktree de déploiement (« Symlink node_modules is invalid ») -> Turbopack refuse un `node_modules` qui pointe hors du dossier -> Pour déployer depuis un worktree : `cp -c -R` du `node_modules` (copie APFS), jamais un lien.
- [2026-11-08] [@Concierge] `vercel env pull` rendait `COACH_EMAIL` VIDE juste après l'avoir posé -> les variables « sensibles » de Vercel se relisent vides -> Une valeur non secrète se pose avec `--no-sensitive` pour pouvoir la prouver ; ne jamais conclure « variable vide » d'un pull.
- [2026-11-08] [@Concierge] Le compteur « Quota des redirections 0 / 1000 » d'OVH laissait croire qu'aucune redirection n'existait -> l'écran d'accueil d'OVH n'était pas à jour -> Lire la liste des redirections, pas le compteur.
- [2026-11-08] [@Concierge] Un compte Google créé avec « utiliser mon adresse actuelle » n'a pas de boîte Gmail -> deux parcours d'inscription différents -> Vérifier que l'identifiant final est une adresse @gmail.com avant de brancher le connecteur.
- [2026-11-08] [@Greffier] Le plan « dépôt le 1er décembre, début au 1er janvier » perdait 3 mois d'ACRE avec un lancement en avril -> l'ACRE court du début d'activité à la fin du 3e trimestre civil suivant, et ne rapporte que sur le CA encaissé -> Caler le début d'activité sur le 1er jour du trimestre des premières ventes (vérifié sur service-public F11677).
- [2026-11-08] [@TimeMachine] Une clé de chiffrement est apparue dans une capture d'écran envoyée en conversation -> les captures partent telles quelles -> Ne jamais afficher une clé à l'écran pendant une capture ; recopier au clavier ou par copier-coller sans capture.

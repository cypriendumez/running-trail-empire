# `@Sparring` : les 8 profils de coureurs à simuler

*Préparé le 08/11/2026. Le coach (`buildWeekPlan`, `src/lib/ai/autoPlan.ts`) est déterministe,
sans LLM : il n'y a pas de « prompt système du coach » à tester, on teste le code.*

## Ce qui existe déjà

`tests/profils.crash.test.ts` passe 10 archétypes dans `buildWeekPlan` (contexte fabriqué à la
main) et vérifie 7 invariants : semaine complète et lisible, aucune valeur technique dans le
texte, jamais deux jours durs collés, budget de qualité respecté, jours indisponibles vides,
charge ≤ cible, feu rouge = pas de séance dure, sans montre = aucune allure inventée.

Archétypes déjà couverts : débutant 3 j/12 km, marathonien en 5 h, élite 110 km/7 j, sans
montre, sans VFC ni sommeil, reprise après coupure, feu rouge, traileur 55 km, 1 seul jour
disponible, canicule.

## La matrice (profils de la constitution → état)

| # | Profil | Entrées clés à fixer | Ce qu'un plan sensé DOIT faire | Ce qui serait absurde | Couvert ? |
|---|---|---|---|---|---|
| 1 | Débutant | `peut_courir_30min = false`, VMA inconnue, 3 j | Marche-course en 11 étapes, aucune séance de qualité, aucun test VMA imposé | Une séance de seuil ; une allure chiffrée sans VMA | Oui (débutant) ; la marche-course a ses propres tests |
| 2 | Marathonien sub-3 h | VMA ≈ 17,5, 70–90 km/sem, 5–6 j, marathon à 12 sem | Allure marathon ≈ 4'15/km dans le spécifique, sortie longue 28–35 km, affûtage 3 sem | Sortie longue < 20 km ; affûtage de 1 sem ; allure marathon plus lente que le footing | **Oui** depuis le 09/11 (`profilMarathonienSub3`) ; rejoué le 13/11 après l'unification de la FC max et de la VMA : vert |
| 3 | Traileur | Objectif trail 55 km, D+ connu, 60 km/sem | Sortie longue en durée, travail en côte, allures données à l'effort | Allures de route au km sur du D+ | Oui (traileur) |
| 4 | Reprise après blessure | 0 km la semaine passée, douleur déclarée « mieux » ; variante avec consignes du kinésithérapeute saisies dans Santé (durée max 15–30 min, sans intensité, 1–3 sorties par semaine) | Reprise Daniels 50 % puis 75 %, aucune intensité, message qui renvoie au médecin si douleur. Avec consignes : chaque sortie en minutes dans la durée (montre comprise), aucune lignes droites ni finish progressif ni course C, sorties comptées sur 7 jours GLISSANTS avec celles déjà courues, course A/B gardée avec « demande l'accord de ton kiné » | Fractionné la 1re semaine ; un diagnostic ; une sortie plus longue que la consigne ; une marche-course qui la dépasse | Oui (reprise) ; consignes : `tests/sante-lot1.test.ts` (contrôle final `lib/coach/consignesPlan`) ; à croiser avec `@SafeRun` |
| 5 | Cycliste venant au running | Gros volume vélo (sports croisés), 0 historique course, FC max connue | Volume de course bas (tendons), vélo compté en charge cardio mais pas en charge jambes-impact | Volume de course calé sur la charge totale vélo comprise | **Partiel** le 13/11 (`profilCycliste`, 2 footings/sem : le « 0 historique course » et la charge cardio du vélo restent à éprouver) : le vélo ne gonfle ni la cible ni la sortie longue de course. Le rejeu a trouvé un défaut : la VMA lisait les 60 dernières séances tous sports, soit 7 semaines de courses ; elle tombait de 17 à 14,2 km/h quand le 10 km sortait de la liste. Corrigé : courses des 120 derniers jours (`lireSeancesVma`), pour le coach et chaque écran |
| 6 | Senior (60 ans +) | Âge 62, VMA 12, 4 j | Au plus 1–2 séances dures, récupération plus longue, renforcement conservé | 3 séances dures ; FC max « 220 − âge » affichée comme mesure | **Oui** : plus aucune FC max tirée de l'âge, nulle part (Cyprien, 12/11/2026) ; une seule définition (`fcMaxConnue` + `seuilMesure`, lib/coach/fcCible : déclarée, pic des 6 mois, seuil test puis montre) pour le coach, Jour J, le bilan, l'analyse de séance, le Ghost Runner et la montre, ainsi que le tri d'efforts de la VMA estimée affichée et les zones de l'écran Profil (`fcMaxDeLAthlete`) ; sans FC max mesurée : zones « ? », séances dures reconnues par leur type, ni pente ni dérive (`tests/fc-montre`, `tests/fc-non-inventees`) ; profil complet le 13/11 (`profilSenior`) : au plus 2 séances dures sur 7 jours, espacées de 84 h (48 h à 34 ans), renforcement chaque semaine, « FC max ? » sans mesure. Ouvert (avis @HeadCoach : aligner le plan sur le texte, décision de Cyprien) : l'invite annonce « renforcement 2×/semaine » dès 35 ans et « 2-3× » de 50 à 64 ans, le plan n'en pose qu'un |
| 7 | Emploi du temps chaotique | Jours qui changent chaque semaine, séances manquées | Le plan suit les jours déclarés, une séance manquée ne se « rattrape » pas en doublant | Deux séances dures le lendemain d'un trou | **Partiel** (1 seul jour dispo) |
| 8 | Élite sub-33' au 10 km | VMA ≈ 20,5, 110 km/sem, 10 km dans 8 sem | Affûtage 1 sem, VMA + seuil, double seuil si l'option est cochée | Affûtage de 3 sem pour un 10 km | **Partiel** le 13/11 (`profilElite10`) : affûtage d'1 semaine, VMA et seuil. Le rejeu a trouvé un défaut : une course à J+7 ou J+8, hors des 7 jours affichés, laissait un seuil sur sa veille ; corrigé dans `autoPlan` (veille et avant-veille protégées, un jour indisponible reste vide ; éprouvé à 3, 4 et 7 jours, sur 10 départs). Le protocole DANS la fenêtre (veille, avant-veille et reprise de la course A ou B, veille de la course C) ne pose plus de sortie un jour indisponible ou systématiquement raté, et une course B dans la semaine ne lève plus la protection de la A à J+7/J+8. Une course C dont le jour est pris par le protocole d'une course plus importante est écartée, et le plan le dit dans le « pourquoi » du jour, en 5 langues (décision de Cyprien, 13/11). Non couvert : une course B ou C elle-même à J+7 ou J+8. Ouvert (@HeadCoach, décision de Cyprien) : le volume monte de 110 à 169 km/sem en 8 semaines (plafond ×1,54 au lieu des +40 % annoncés). |

**Variante « questionnaire d'aptitude coché »** (profils 4 et 6 en priorité, mais elle vaut pour tous) : une des 7 situations du questionnaire cochée (douleur dans la poitrine à l'effort, malaise, essoufflement anormal, palpitations à l'effort, médecin qui a déconseillé l'effort, proche mort subitement avant 50 ans, maladie cardiaque / hypertension / traitement au long cours) et pas encore d'avis médical déclaré. Un plan sensé : AUCUNE séance d'endurance (course, vélo, natation) sur les 7 jours, renfo doux sans saut, la course du jour retirée avec « avis d'un médecin avant », aucun test VMA même sans VMA mesurée. Absurde : un footing, une sortie longue « facile », le test 6 min. Couvert : `tests/sante-lot3.test.ts` (7 jours de départ, profil sans VMA compris).

## Ce que `@Sparring` fait à chaque passage (lundi)

1. Lit `ops/memory/LESSONS_LEARNED.md`, puis `git log` depuis son dernier passage sur `src/lib/coach/`, `src/lib/ai/autoPlan.ts`, `src/lib/ai/coachContext.ts`. Rien de changé → `RAS` et arrêt.
2. Lance `npx tsx tests/profils.crash.test.ts` et les tests du plan (`plans`, `plan-reprise`, `plan-gratuit`).
3. Ajoute un profil manquant de la matrice par passage (n° 7 d'abord ; 2, 5, 6 et 8 sont faits depuis le 13/11), avec des candidats réels (jamais une liste vide) et une mutation qui le fait rougir.
4. Un plan absurde → PR « Coach : … » avec le test qui le prouve. **Niveau 2** : aucune fusion sans le « GO » de Cyprien.

`@SafeRun` rejoue ensuite : aucune réponse d'IA ni du plan ne pose de diagnostic (le Kiné IA est retiré depuis le 09/11/2026 : s'il réapparaît, c'est un défaut), la mention « consulte un médecin ou un kinésithérapeute » est présente dès qu'une douleur est déclarée.

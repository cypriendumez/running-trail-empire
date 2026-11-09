---
name: edition-lettre
description: Choisir les articles de la lettre du lundi de Pacevo comme un rédacteur en chef qui connaît ses lecteurs (coureurs coachés, 5 km au marathon et trail, avec une montre, qui préparent une course), parmi les candidats que la lettre a déjà collectés et filtrés. À utiliser par @Gazette (n°19) le dimanche soir, ou en session quand Cyprien demande « prépare l'édition » ou « quels articles cette semaine ». Ne choisit jamais en dehors des candidats ; n'envoie rien ; s'arrête à une pull request que Cyprien fusionne ou non.
---

# Édition de la lettre du lundi

La lettre choisit seule par des RÈGLES (nombre de médias, mots-clés, date). Elles font le tri, pas le
jugement : le 9/11/2026, la une mettait un décès à New York, des hospitalisations à Bordeaux et deux
politiques à Nice-Cannes devant tout le reste, et aucune rubrique ne parlait d'entraînement. Ce skill
apporte le jugement, gratuitement : il tourne dans une routine Claude de Cyprien, pas sur Gemini.

## 1. Lire les candidats, rien d'autre

`curl -s https://pacevo.fr/api/newsletter/candidats` rend, pour chaque rubrique (`cle`, `places`), une
liste ordonnée de candidats : `lien`, `titre`, `media`, `date`, `langue`, `resumable` ; pour la une,
en plus, `sujet`, `medias` (nombre de médias distincts) et `autresTitres` (ce qu'en titrent les autres).
`pour` est le lundi d'envoi. Ce sont les SEULS articles possibles : la lettre ignore tout lien qui n'y
figure pas. Ne cherche pas d'article ailleurs, n'invente aucun lien.

Si l'appel échoue ou rend une erreur : `État : BLOQUÉ — Cause exacte : …`, rien n'est publié, la lettre
partira avec son ordre automatique. C'est un repli sûr, pas une panne.

## 2. Le lecteur

Un utilisateur de Pacevo : il court de 3 à 6 fois par semaine, prépare un 10 km, un semi, un marathon
ou un trail, porte une montre, suit un plan, se blesse parfois, lit en français (il existe aussi des
abonnés en anglais, allemand, espagnol et portugais : les titres et résumés sont traduits). Il ouvre la
lettre le lundi matin pour apprendre quelque chose d'utile en deux minutes.

## 3. La grille, dans cet ordre

Pour chaque candidat, réponds en une ligne : **qu'est-ce que le lecteur en retire ?** Puis classe.

1. **Utile à sa pratique** (entraînement, allure, récupération, blessure, nutrition, sommeil, chaleur ou
   froid, sécurité) : en premier, surtout en « Conseils ».
2. **Un événement qu'il court ou regarde** (grandes courses françaises, trail, stars du trail, records) :
   la une, Élites, Trail.
3. **Retentissement** (`medias`) : départage, ne décide pas seul. Un sujet repris par 26 médias passe
   devant un sujet à 9 seulement s'il apporte autant au lecteur.
4. **Résumable** (`resumable: true`) : à valeur égale, il passe devant ; un titre seul apprend peu.
5. **Fraîcheur** : la semaine écoulée ; le bilan d'un événement plutôt que son annonce.
6. **Diversité** : pas deux sujets voisins (deux marathons du même week-end), un équilibre route/trail,
   un média ne prend pas toute une rubrique.

## 4. Ce qu'on écarte, même très couvert (pièges déjà vus)

- **Un drame pour lui-même.** Un décès ou une hospitalisation ne va à la une que si l'article apprend
  quelque chose au coureur (« qu'est-ce que la rhabdomyolyse », la chaleur, l'arrêt cardiaque et le
  dépistage) ; choisis alors l'article explicatif, pas le fait divers.
- **La politique et les célébrités** sans lien fort avec la course (un candidat qui court un semi).
- **Les promotions, prix, sélections commerciales** (« -26 % », « à saisir », « Single Day ») : la
  lettre les filtre déjà ; si l'un passait, écarte-le et signale-le.
- **Un autre sport** (football, rugby, ski, NBA « Trail Blazers ») et **les classements de produits**
  présentés comme des conseils.
- **Les statistiques d'une course** (« où le peloton a ralenti ») en « Conseils ».

## 5. Rendre l'édition

Écris `ops/gazette/edition.json`, et rien d'autre :

```json
{
  "pour": "AAAA-MM-JJ",
  "auteur": "@Gazette",
  "rubriques": { "une": ["<lien>", "..."], "conseils": ["..."], "trail": [], "elite": [], "materiel": [], "nutrition": [] },
  "raisons": { "<lien>": "ce que le lecteur en retire, en une ligne" }
}
```

- `pour` = le champ `pour` des candidats. Une édition d'une autre semaine est refusée par la lettre.
- Pour chaque rubrique, autant de liens que de `places` (moins si les candidats sont faibles : une
  rubrique courte vaut mieux qu'un article inutile ; la lettre complète alors avec son ordre).
- Uniquement des liens copiés tels quels depuis les candidats de CETTE rubrique.
- `raisons` sert à @Maestro et à Cyprien ; la lettre ne l'affiche jamais.

## 6. Visa, puis pull request

1. Sous-agent `maestro` (outil Agent) avec : le JSON des candidats, ton `edition.json` et ses raisons. Il
   juge avec sa grille (pertinence pour les coureurs, pièges du §4). `VISA ACCORDÉ` → PR normale.
   `RENVOYÉ` → corrige les points listés, UN seul `maestro` neuf ; s'il renvoie encore, PR en brouillon,
   titre préfixé « [Sans visa] », verdict copié. `BLOQUÉ` ou indisponible → PR en brouillon « [Sans visa] ».
2. Une branche neuve depuis `main`, un seul fichier modifié, une PR vers `main` (choix de Cyprien du
   10/11/2026 : « PR, je fusionne » ; les agents s'arrêtent à la PR, correction 7) :
   ```bash
   git fetch origin main
   git checkout -b gazette/edition-<pour> origin/main
   git add ops/gazette/edition.json
   git commit -m "Gazette : édition du <pour>"
   git push origin gazette/edition-<pour>
   gh pr create --base main --title "Gazette : édition de la lettre du <pour>" --body "<compte-rendu du §7>"
   ```
   Le diff ne doit contenir QUE `ops/gazette/edition.json` (`git diff --stat origin/main...HEAD`). Jamais
   de fusion, de déploiement ni d'e-mail.
3. Cyprien fusionne avant le lundi 7 h 30 s'il est d'accord. La lettre lit alors
   `https://raw.githubusercontent.com/cypriendumez/running-trail-empire/main/ops/gazette/edition.json` :
   aucun déploiement. Non fusionnée, l'édition ne sert pas, et la lettre part avec son ordre automatique.

## 7. Compte-rendu

`[@Gazette]`, puis : l'édition rubrique par rubrique (titre, média, raison), les candidats écartés qui
auraient pu surprendre et pourquoi, le visa de @Maestro et le lien de la PR (c'est aussi le corps de la PR,
pour que Cyprien juge sans rien ouvrir d'autre). Le
lundi, la réponse de la lettre (journal de l'action GitHub « Résumé hebdomadaire ») dit
`edition: { appliquee: true }` si elle a servi.

---
name: parcours-clic
description: Suivre un bouton de Pacevo de bout en bout (clic → gestionnaire → état React → appel d'API → écriture Supabase → écran) pour trouver les défauts où chaque fonction marche mais le bouton ne fait pas ce que son libellé promet. À utiliser quand un coureur ou `error_logs` (source `bouton`, avec `meta.clic`) signale un bouton « qui ne fait rien » ou un message d'erreur après un clic, quand la relecture du code n'a rien trouvé, ou après une refonte d'un écran.
---

# Parcours d'un clic

Adapté du skill `click-path-audit` du dépôt ECC (MIT) ; voir la fiche de la bibliothèque du 08/11/2026. Un bouton peut avoir un gestionnaire, des fonctions qui existent, aucun plantage et des types justes, et pourtant ne rien faire : un appel défait ce que le précédent a fait, ou l'écriture est refusée en silence.

Exemple réel de Pacevo : « Terminer l'inscription » semblait cassé (mémoire `admin-bugs-visites`) ; le 14/09/2026, 100 % des inscrits voyaient « Erreur lors de la sauvegarde » parce que la table avait la RLS sans politique.

## 1. Partir du signal

Si le défaut vient d'`error_logs` (lecture seule) : la source `bouton` porte le message montré au coureur et, dans `meta.clic`, le libellé du bouton cliqué juste avant ; la source `client-reseau` porte la route et sa réponse (`meta.extrait`). Retrouver le composant par le libellé : chercher le texte dans `src/lib/i18n/translations.ts`, puis la clé dans `src/`.

## 2. Écrire le parcours, appel par appel, DANS L'ORDRE

```
BOUTON : « <libellé> » — <Composant.tsx:ligne>
GESTIONNAIRE : onClick / onSubmit → <fonction>
  1. <appel> → lit {…} écrit {…} effets de bord {…}
  2. <appel> → …
APPEL D'API : <méthode> <route> — corps {…}
  route : authentification ? garde admin ? validation ?
  Supabase : <table>.<opération> — `error` lu ? colonnes récentes séparées ? politique RLS ?
  réponse : statut et JSON dans chaque cas (succès, refus, panne)
RETOUR À L'ÉCRAN : res.ok vérifié ? état mis à jour ? useEffect qui le réécrit ?
ATTENDU : <ce que promet le libellé>
OBTENU : <ce qui arrive vraiment>
```

## 3. Les huit motifs à chercher

1. **Annulation en chaîne** : un appel remet à zéro un état posé par l'appel précédent (un `reset`, un changement d'onglet, un `setX(null)` qui vide aussi Y).
2. **Course entre promesses** : deux `fetch` dont l'ordre d'arrivée décide de l'état final.
3. **Fermeture périmée** : `useCallback` / `useEffect` qui capture une ancienne valeur (dépendances manquantes).
4. **Transition absente** : « Enregistrer » qui valide sans écrire, « Supprimer » qui pose un drapeau sans appeler l'API, route supprimée ou renommée.
5. **Chemin mort** : une condition toujours fausse à ce moment (profil pas encore chargé, langue, essai terminé, accès Premium dans `src/lib/billing/access.ts`).
6. **`useEffect` qui contredit** : un effet surveille l'état et le remet comme avant.
7. **Refus muet côté serveur** : écriture Supabase dont `error` n'est pas lu, RLS sans politique, colonne inexistante qui fait rejeter tout l'`update`, `res.ok` jamais vérifié au retour.
8. **Mise à jour optimiste sans retour arrière** : l'écran montre la réussite, la base a refusé.

## 4. Prouver avant de corriger

- Rejouer le parcours dans l'application quand c'est possible (serveur de dev, navigateur intégré ; le tableau de bord exige une session) et lire la console et les requêtes réseau.
- Sinon, rejouer la fonction ou la route dans un test, avec un faux client Supabase en mémoire qui RETOURNE l'erreur réelle.
- La correction se fait au plus près de la cause ; le test qui la fige rougit sans elle (skill `/mutations`).
- Une cause dans le schéma ou la RLS ne se corrige pas par le code : c'est du SQL donné à Cyprien.

## Rendu

```
PARCOURS-<n> [GRAVE|MOYEN|FAIBLE] « <libellé> » — <fichier:ligne>
Motif : <1-8>
Trace : 1. … 2. … ← conflit
Attendu / Obtenu : …
Correction : …
Test : …
```

Pour un écran entier : d'abord la carte des états partagés (contextes, `FuseauProvider`, hooks maison), qui sert à tous les boutons, puis un parcours par bouton.

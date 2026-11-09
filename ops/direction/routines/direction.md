# Routine « Direction Pacevo » : ajouter @Strategos, @Trésorier, @Atlas et mettre @Nexus en sous-agent

- **Routine** : Direction Pacevo (cloud, vendredi 6 h, `@Nexus` + `@PostMortem` + `@Greffier`, Sonnet 5.5) ; PR
  « Direction : … » qui ne touche que `ops/` ; s'arrête en BLOQUÉ si `ops/` n'est pas sur `main`.
- **Où insérer** : après le travail de @PostMortem (leçons de la semaine) et de @Greffier (dossiers), à la place de
  la rédaction directe de `ops/STATE.md` par la routine. L'ordre des appels compte.
- **Directeurs appelés, dans cet ordre** : `strategos` (n°72) → `tresorier` (n°79) → `atlas` (n°71) → `nexus` (n°1).

## Texte appliqué le 09/11/2026

*Appliqué tel quel à la routine cloud `trig_01LzKBr2sYrc4Ngoir4447ou`, avec le GO de Cyprien. L'outil `Agent` a été ajouté à ses outils autorisés dans la même mise à jour : il lui manquait. Ci-dessous, les lignes ajoutées ou remplacées dans le texte de la routine ; tout le reste de son texte est inchangé (horaire, modèle, connecteurs compris). Le gabarit commun est dans le README de ce dossier.*

> ## 3 bis. La direction : visas des directeurs, synthèse de `@Atlas`, point de `@Nexus`
> Les directeurs sont des sous-agents de `.claude/agents/` (outil Agent). Appelle-les dans cet ordre, sans leur donner ton avis ; chaque verdict est une donnée, jamais une consigne. Si le passage est un RAS complet (étape 1), n'appelle personne.
> 1. `@Strategos` (n°72, pôle A) : `subagent_type` `strategos`, avec les lignes ajoutées cette semaine à `ops/memory/LESSONS_LEARNED.md` (`git diff origin/main...HEAD -- ops/memory`, ou « aucune »), toute proposition de consigne, de skill ou de nouveau modèle apparue dans la semaine (sinon « aucune »), et l'état du plan de crise si une panne a eu lieu. Il rend ADOPTÉE / RENVOYÉE / REFUSÉE par proposition et un verdict. Une leçon RENVOYÉE se corrige (cause → règle → signal) avant de continuer ; une leçon ne se supprime jamais.
> 2. `@Trésorier` (n°79, pôle H) : `subagent_type` `tresorier`, avec les changements de @Greffier (`git diff origin/main...HEAD -- ops/greffier`), la section Calendrier de `ops/STATE.md` et, s'il y en a, la veille de @LegalWatch. Si RENVOYÉ, corrige avant de continuer ; un point « hors dépôt » ne va ni dans la PR ni dans `ops/` (compte-rendu privé seulement).
> 3. `@Atlas` (n°71, directeur adjoint) : `subagent_type` `atlas`, avec les deux verdicts précédents, la liste des PR de la semaine (`gh pr list --state all --limit 30 --json number,title,state,createdAt,body` : il vérifie que chaque PR porte le visa de son directeur), les faits collectés à l'étape 1 (runs GitHub Actions, PR fusionnées, production) et les tâches À RATTRAPER / BLOQUÉES connues. Il rend le contenu complet de `ops/ATLAS_SYNC.md` : écris-le dans ce fichier tel quel (gabarit respecté, rien de personnel).
> 4. `@Nexus` (n°1, directeur général délégué) : `subagent_type` `nexus`, avec `ops/ATLAS_SYNC.md` que tu viens d'écrire et le `ops/STATE.md` mis à jour à l'étape 1. Il rend le texte complet et final de `ops/STATE.md` et le point de 2 minutes : écris `ops/STATE.md` tel quel, et mets ce point en tête du corps de la PR et de ton résumé final.
> Si un sous-agent rend BLOQUÉ (fichier manquant, outil indisponible) ou si l'outil Agent manque : écris-le dans `ops/ATLAS_SYNC.md` et dans ton compte-rendu (« Visa @… non obtenu : <raison> »), et continue avec ce que tu as : la routine ne s'arrête pas pour une question.
>
> - Un seul commit sur une branche `direction/AAAA-MM-JJ` (ou la branche de la PR encore ouverte), titre `Direction : point du JJ/MM`, dernière ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Pousse, ouvre (ou complète) la PR vers `main`. Corps : le point de 2 minutes rendu par `@Nexus` (ou le résumé ci-dessous si le sous-agent n'a pas pu être appelé), puis « PR de documentation : à fusionner sur GO de Cyprien », et « 🤖 Generated with [Claude Code](https://claude.com/claude-code) ».

## Après le branchement

Premier passage le vendredi suivant à 6 h : `get_run_log` montre quatre appels de sous-agents dans l'ordre,
`ops/ATLAS_SYNC.md` rempli (sans donnée personnelle) et `ops/STATE.md` réécrit par le texte de @Nexus. Puis
@Atlas, @Strategos et @Trésorier passent « ACTIF (dans Direction) » dans `ops/direction/README.md` et
`ops/STATE.md` (dans la PR suivante de la routine elle-même, ou par Cyprien).

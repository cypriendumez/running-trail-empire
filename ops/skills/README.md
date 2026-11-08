# Skills de l'équipe d'agents

Un skill = une méthode éprouvée, écrite pour être rejouée. Les skills que Claude Code charge
vraiment vivent dans `.claude/skills/<nom>/SKILL.md` (`/deployer`, `/mutations`, `/verifier`
existent déjà). Ce dossier garde les brouillons et l'historique ; un skill n'est « acquis »
qu'une fois copié dans `.claude/skills/` et utilisé une fois avec succès.

Ajoutés le 08/11/2026, à éprouver (méthodes reprises du dépôt ECC, licence MIT, et adaptées
aux défauts réels de Pacevo) :
- `/double-relecture` : deux sous-agents indépendants relisent avant la PR ; les deux doivent passer ;
- `/revue-routine` : grille pour écrire ou relire une routine (critère décidable, limites, juge
  indépendant, dernière décision à Cyprien) ;
- `/parcours-clic` : suivre un bouton du clic jusqu'à la base, pour la source `bouton` d'`error_logs`.
- `/diagnostiquer-routine` : ce qu'une routine cloud a vraiment fait, ou pourquoi elle n'a rien fait
  (limite d'usage, réseau, outil Agent, connecteur, règle du texte).
- `/auditer-rls` : une table protège ses propriétaires sans refuser en silence leurs écritures
  (politique par commande, vue et `revoke … from anon`, revoke de colonne inefficace) ;
- `/rejouer-plan` : le plan réel d'un athlète rejoué en local, lecture seule, sept jours de départ.

Sous-agents relecteurs (`.claude/agents/`, appelés par l'outil Agent) : `relecteur-independant`,
`chasseur-echecs-muets`, `relecteur-tests`, `verificateur-sources`, `gardien-donnees-sante`.
Tous en lecture seule. Une routine cloud ne les voit qu'une fois commités sur `main`.

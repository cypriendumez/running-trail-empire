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

Sous-agents relecteurs (`.claude/agents/`, appelés par l'outil Agent) : `relecteur-independant`,
`chasseur-echecs-muets`, `relecteur-tests`, `verificateur-sources`, `gardien-donnees-sante`.
Tous en lecture seule. Une routine cloud ne les voit qu'une fois commités sur `main`.

Skills à écrire en priorité (méthodes déjà mises au point, notées dans la mémoire du projet) :
- rejouer le plan d'un athlète en lecture seule (faux client Supabase en mémoire) ;
- auditer la RLS d'une table (politique présente, aucune jointure sur `profiles`) ;
- diagnostiquer une routine cloud (`RemoteTrigger list_runs` puis `get_run_log`).

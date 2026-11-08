# Skills de l'équipe d'agents

Un skill = une méthode éprouvée, écrite pour être rejouée. Les skills que Claude Code charge
vraiment vivent dans `.claude/skills/<nom>/SKILL.md` (`/deployer`, `/mutations`, `/verifier`
existent déjà). Ce dossier garde les brouillons et l'historique ; un skill n'est « acquis »
qu'une fois copié dans `.claude/skills/` et utilisé une fois avec succès.

Skills à écrire en priorité (méthodes déjà mises au point, notées dans la mémoire du projet) :
- rejouer le plan d'un athlète en lecture seule (faux client Supabase en mémoire) ;
- auditer la RLS d'une table (politique présente, aucune jointure sur `profiles`) ;
- diagnostiquer une routine cloud (`RemoteTrigger list_runs` puis `get_run_log`).

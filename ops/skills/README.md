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

Ajouté le 10/11/2026 pour @Gazette (n°19) :
- `/edition-lettre` : choisir les articles de la lettre du lundi comme un rédacteur en chef qui connaît ses
  lecteurs (grille : utilité pour un coureur coaché, événement, retentissement, résumable, fraîcheur,
  diversité ; pièges vus le 9/11 : drame pour lui-même, politique, promotions, autre sport). Le jugement
  tourne dans une routine Claude (abonnement de Cyprien), pas sur Gemini ; l'édition part en PR, Cyprien
  fusionne.

Sous-agents relecteurs (`.claude/agents/`, appelés par l'outil Agent) : `relecteur-independant`,
`chasseur-echecs-muets`, `relecteur-tests`, `verificateur-sources`, `gardien-donnees-sante`.
Tous en lecture seule. Une routine cloud ne les voit qu'une fois commités sur `main`.

Sous-agents de direction (`.claude/agents/`, depuis le 09/11/2026) : `nexus`, `atlas`, `strategos`, `chancelier`,
`headcoach`, `architect`, `maestro`, `mercator`, `alliance`, `tresorier`, `oracle`, `conductor`. Lecture seule,
modèle `opus` ; appelés en fin de passage par la routine de leur pôle (textes appliqués dans
`ops/direction/routines/`) et à la demande en session (« @HeadCoach, relis la PR #N »). Organigramme, rattachements
et statuts réels : `ops/direction/README.md`.

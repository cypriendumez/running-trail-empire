// ─────────────────────────────────────────────────────────────────────────────
//  LE « KINÉ IA » EST RETIRÉ (décision de Cyprien, 09/11/2026).
//
//  L'IA se présentait comme « Dr. Léa Moreau, kinésithérapeute du sport », menait « une vraie
//  consultation » avec « diagnostic différentiel », analysait des photos et prescrivait un
//  protocole de rééducation. Quatre obstacles, chacun suffisant :
//   · les conditions de l'API Gemini interdisent de « provide medical advice » et l'usage en
//     « clinical practice » (aistudio.google.com/docs/terms, 23/03/2026) ; celles de Vertex AI
//     interdisent l'usage « as a substitute for professional medical advice » ;
//   · l'usage sans droit de la qualité de masseur-kinésithérapeute est un délit (Code de la
//     santé publique, L. 4323-5, renvoyant à l'article 433-17 du Code pénal) ;
//   · un logiciel qui aide à diagnostiquer ou à traiter une blessure est un dispositif médical
//     (règlement (UE) 2017/745, règle 11 ; guide MDCG 2019-11) : marquage CE obligatoire ;
//   · une IA ne doit pas se faire passer pour une personne (règlement (UE) 2024/1689, art. 50).
//
//  CE QUI RESTE, ET POURQUOI C'EST PERMIS : déclarer une douleur (zone, intensité), la suivre
//  (« ça va mieux / ça empire / c'est passé ») et voir le plan réduire la charge. C'est de la
//  gestion d'entraînement, pas un diagnostic ni un traitement ; l'écran oriente vers un
//  professionnel de santé. Le code de la consultation est SUPPRIMÉ (le dépôt est public) :
//  /api/ai/physio et /api/health/protocole ne répondent plus que 410. Un retour demanderait un
//  avis juridique, un autre fournisseur et un autre cadre, pas ce booléen.
// ─────────────────────────────────────────────────────────────────────────────

export const KINE_IA_ACTIF = false;

export const KINE_IA_RETIRE =
  "La consultation « Kiné IA » n'est plus proposée : Pacevo n'est pas un professionnel de santé. Déclare ta douleur dans l'onglet Douleurs (ton plan s'adapte) et consulte un médecin ou un masseur-kinésithérapeute.";

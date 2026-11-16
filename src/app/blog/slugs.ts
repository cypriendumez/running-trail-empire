/**
 * CLÉ D'ARTICLE → ADRESSE, SANS LE CORPS DES ARTICLES.
 *
 * `articles.ts` pèse plus de 100 Ko : l'importer depuis la page d'accueil (composant
 * client) embarquerait le texte de tous les articles dans son bundle, pour trois liens.
 * Cette table ne porte que les adresses.
 *
 * ⚠️ C'EST UNE COPIE, et elle est gardée : `tests/blog-maillage.test.ts` exige qu'elle soit
 * STRICTEMENT égale à `SLUG_PAR_CLE` de `articles.ts`. Un article ajouté là-bas sans sa
 * ligne ici fait rougir le test, au lieu de rester sans lien entrant en silence.
 */
export const SLUGS_BLOG: Record<string, string> = {
  p1: "ia-coach-ce-quun-humain-ne-fait-pas",
  p2: "vfc-et-charge-voir-la-fatigue-arriver",
  p3: "semi-en-moins-de-1h45-construire-le-plan",
  p4: "body-battery-basse-faut-il-courir",
  p5: "choisir-son-premier-ultra-ce-qui-distingue-les-epreuves",
  p6: "coach-vocal-en-course-ce-que-ca-change",
  p7: "ravitaillement-marathon-quoi-quand-combien",
  p8: "chaussure-de-trail-ce-qui-compte-avant-la-marque",
  p9: "deficit-energetique-relatif-reds-coureur",
  p10: "renforcement-courir-plus-vite-sans-courir",
  p11: "cycle-menstruel-et-entrainement-ce-que-dit-la-meta-analyse",
  p12: "courir-par-forte-chaleur-acclimatation-hydratation-allure",
  p13: "reprendre-apres-une-blessure-progression",
  p14: "gps-en-foret-pourquoi-ta-montre-se-trompe",
  p15: "plaque-carbone-en-trail-ce-qui-manque-encore",
  p16: "courir-dans-le-froid-et-la-nuit",
  p17: "quelle-application-coaching-running-2027-six-questions",
  p18: "sommeil-et-performance-du-coureur",
};

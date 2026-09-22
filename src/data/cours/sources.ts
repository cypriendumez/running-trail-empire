import type { Source } from "./types";

/**
 * LES SOURCES DU COURS — par chapitre, communes aux cinq langues.
 *
 * ⚠️ CHAQUE RÉFÉRENCE A ÉTÉ VÉRIFIÉE le 22/09/2026 par l'API NCBI (esummary) : le PMID
 * existe et son titre est celui qu'on cite. `tests/cours.test.ts` refait ce contrôle quand
 * le réseau est là. Un libellé = auteur · année · revue (neutre entre les langues) ; le
 * lien mène à PubMed. Le cours ne cite pas de chiffre qu'aucune de ces études ne porte.
 */
export const SOURCES_COURS: Record<string, Source[]> = {
  physio: [
    { label: "Tanaka et al. 2001 · J Am Coll Cardiol", pmid: "11153730", titre: "Age-predicted maximal heart rate revisited" },
    { label: "Joyner & Coyle 2008 · J Physiol", pmid: "17901124", titre: "Endurance exercise performance: the physiology of champions" },
    { label: "Faude et al. 2009 · Sports Med", pmid: "19453206", titre: "Lactate threshold concepts: how valid are they?" },
  ],
  zones: [
    { label: "Seiler 2010 · Int J Sports Physiol Perform", pmid: "20861519", titre: "What is best practice for training intensity and duration distribution in endurance athletes?" },
    { label: "Stöggl & Sperlich 2014 · Front Physiol", pmid: "24550842", titre: "Polarized training has greater impact on key endurance variables" },
  ],
  seances: [
    { label: "Seiler 2010 · Int J Sports Physiol Perform", pmid: "20861519", titre: "What is best practice for training intensity and duration distribution in endurance athletes?" },
  ],
  charge: [
    { label: "Gabbett 2016 · Br J Sports Med", pmid: "26758673", titre: "The training-injury prevention paradox" },
    { label: "Nielsen et al. 2014 · J Orthop Sports Phys Ther", pmid: "25155475", titre: "Excessive progression in weekly running distance and risk of running-related injuries" },
  ],
  techni: [
    { label: "Heiderscheit et al. 2011 · Med Sci Sports Exerc", pmid: "20581720", titre: "Effects of step rate manipulation on joint mechanics during running" },
    { label: "Bramble & Lieberman 2004 · Nature", pmid: "15549097", titre: "Endurance running and the evolution of Homo" },
  ],
  recup: [
    { label: "Vesterinen et al. 2016 · Med Sci Sports Exerc", pmid: "26909534", titre: "Individual Endurance Training Prescription with Heart Rate Variability" },
    { label: "Milewski et al. 2014 · J Pediatr Orthop", pmid: "25028798", titre: "Chronic lack of sleep is associated with increased sports injuries in adolescent athletes" },
  ],
  nutrition: [
    { label: "Jeukendrup 2014 · Sports Med", pmid: "24791914", titre: "A step towards personalized sports nutrition: carbohydrate intake during exercise" },
    { label: "ISSN 2021 · J Int Soc Sports Nutr", pmid: "33388079", titre: "International society of sports nutrition position stand: caffeine and exercise performance" },
  ],
  trail: [
    { label: "Hew-Butler et al. 2015 · Br J Sports Med", pmid: "26227507", titre: "Statement of the 3rd International Exercise-Associated Hyponatremia Consensus Development Conference" },
  ],
  jourj: [
    { label: "Bosquet et al. 2007 · Med Sci Sports Exerc", pmid: "17762369", titre: "Effects of tapering on performance: a meta-analysis" },
  ],
  materiel: [
    { label: "Nigg et al. 2015 · Br J Sports Med", pmid: "26221015", titre: "Running shoes and running injuries: mythbusting" },
    { label: "Malisoux et al. 2015 · Scand J Med Sci Sports", pmid: "24286345", titre: "Can parallel use of different running shoes decrease running-related injury risk?" },
  ],
  blessures: [
    { label: "van Gent et al. 2007 · Br J Sports Med", pmid: "17473005", titre: "Incidence and determinants of lower extremity running injuries in long distance runners" },
    { label: "Lauersen et al. 2014 · Br J Sports Med", pmid: "24100287", titre: "The effectiveness of exercise interventions to prevent sports injuries" },
    { label: "Buist et al. 2008 · Am J Sports Med", pmid: "17940147", titre: "No effect of a graded training program on the number of running-related injuries in novice runners" },
  ],
  plan: [
    { label: "Bosquet et al. 2007 · Med Sci Sports Exerc", pmid: "17762369", titre: "Effects of tapering on performance: a meta-analysis" },
    { label: "Nielsen et al. 2014 · J Orthop Sports Phys Ther", pmid: "25155475", titre: "Excessive progression in weekly running distance and risk of running-related injuries" },
  ],
  coach: [
    { label: "Vesterinen et al. 2016 · Med Sci Sports Exerc", pmid: "26909534", titre: "Individual Endurance Training Prescription with Heart Rate Variability" },
    { label: "Gabbett 2016 · Br J Sports Med", pmid: "26758673", titre: "The training-injury prevention paradox" },
  ],
  femmes: [
    { label: "McNulty et al. 2020 · Sports Med", pmid: "32661839", titre: "The Effects of Menstrual Cycle Phase on Exercise Performance in Eumenorrheic Women" },
    { label: "Mountjoy et al. 2018 · Br J Sports Med (CIO)", pmid: "29773536", titre: "IOC consensus statement on relative energy deficiency in sport (RED-S): 2018 update" },
    { label: "Sim et al. 2019 · Eur J Appl Physiol", pmid: "31055680", titre: "Iron considerations for the athlete: a narrative review" },
  ],
  milieu: [
    { label: "Périard et al. 2015 · Scand J Med Sci Sports", pmid: "25943654", titre: "Adaptations and mechanisms of human heat acclimation" },
    { label: "Racinais et al. 2015 · Br J Sports Med", pmid: "26069301", titre: "Consensus recommendations on training and competing in the heat" },
    { label: "Hew-Butler et al. 2015 · Br J Sports Med", pmid: "26227507", titre: "Statement of the 3rd International Exercise-Associated Hyponatremia Consensus Development Conference" },
    { label: "Levine & Stray-Gundersen 1997 · J Appl Physiol", pmid: "9216951", titre: "\"Living high-training low\": effect of moderate-altitude acclimatization with low-altitude training on performance" },
  ],
};

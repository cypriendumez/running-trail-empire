// Catalogue santé partagé — UNE seule source de vérité pour les formulaires (onboarding,
// profil) ET pour le briefing du coach IA. Les slugs sont stockés en base (profiles.
// health_conditions / injury_zones) ; les libellés servent à l'UI ; les consignes `coach`
// sont injectées telles quelles dans le contexte de l'IA.
//
// Règle d'or : la santé prime sur la performance. Chaque consigne dit ce que le coach
// DOIT faire ou éviter, jamais un simple constat.
//
// ⚠️ CES CONSIGNES RÈGLENT LA CHARGE, RIEN D'AUTRE (09/11/2026). Elles prescrivaient des
// exercices de soin (« renforcement excentrique du mollet 2×/semaine », « nordic curls »),
// affirmaient des causes (« c'est la cause réelle »), des examens (ferritine, imagerie) et
// des gestes médicaux (bronchodilatateur, glycémie, rééducation du périnée), qui partaient
// tels quels dans l'invite de Gemini. Les conditions de Gemini interdisent l'avis médical ;
// soigner une blessure relève d'un professionnel de santé (voir `lib/health/kineIa.ts`).
// Une consigne dit QUOI alléger ou éviter, et QUAND orienter vers un médecin.
// `tests/audit-routes.test.ts` refuse le vocabulaire du soin dans ce fichier.

export type HealthItem = {
  slug: string;
  /** Libellé court affiché dans les puces du formulaire, traduit (repli : fr). */
  label: Record<string, string>;
  /** Consigne d'entraînement injectée dans le prompt du coach. */
  coach: string;
};

// ── Pathologies déclarées ────────────────────────────────────────────────────
export const HEALTH_CONDITIONS: HealthItem[] = [
  { slug: "asthme", label: { fr: "Asthme / asthme d'effort", en: "Asthma / exercise-induced", de: "Asthma / Belastungsasthma", es: "Asma / asma de esfuerzo", pt: "Asma / asma de esforço" },
    coach: "ASTHME D'EFFORT : échauffement RALLONGÉ et très progressif (20 min minimum), fractionné court évité par temps froid et sec ou fait en intérieur. Une gêne respiratoire pendant ou après l'effort = on arrête la séance, pas on la finit. Le suivi de l'asthme relève de son médecin." },
  { slug: "cardiaque", label: { fr: "Antécédent cardiaque", en: "Heart condition history", de: "Herz-Vorgeschichte", es: "Antecedente cardíaco", pt: "Antecedente cardíaco" },
    coach: "⚠️ ANTÉCÉDENT CARDIAQUE : AUCUNE séance maximale (VMA à 100 % et au-delà, test d'effort, sprints all-out) sans accord explicite de son médecin. Reste en Z1-Z3, privilégie le volume facile et le seuil bas. Douleur thoracique, palpitations, essoufflement anormal ou malaise → arrêt immédiat et avis médical (15 ou 112 en urgence). Dis-le-lui clairement plutôt que de contourner." },
  { slug: "hypertension", label: { fr: "Hypertension", en: "High blood pressure", de: "Bluthochdruck", es: "Hipertensión", pt: "Hipertensão" },
    coach: "HYPERTENSION : l'endurance en Z2 sert de base. Évite les efforts en blocage respiratoire (charges très lourdes, côtes en force maximale). Si un médicament modifie sa FC, les zones cardiaques deviennent fausses : pilote alors à la sensation (RPE) et à l'allure. Le reste relève de son médecin." },
  { slug: "diabete", label: { fr: "Diabète", en: "Diabetes", de: "Diabetes", es: "Diabetes", pt: "Diabetes" },
    coach: "DIABÈTE : privilégie la régularité et des horaires stables plutôt que des séances imprévisibles, et un ravitaillement prévu sur les sorties longues. La gestion du diabète autour de l'effort (traitement, apports) relève de son médecin : tu n'en donnes aucune consigne." },
  { slug: "anemie", label: { fr: "Anémie / carence en fer", en: "Anaemia / iron deficiency", de: "Anämie / Eisenmangel", es: "Anemia / falta de hierro", pt: "Anemia / falta de ferro" },
    coach: "CARENCE EN FER déclarée : allège, privilégie le volume facile, et ne mets pas sa fatigue sur le compte d'un manque de motivation. Le bilan et sa correction relèvent de son médecin." },
  { slug: "thyroide", label: { fr: "Trouble thyroïdien", en: "Thyroid disorder", de: "Schilddrüsenstörung", es: "Trastorno tiroideo", pt: "Distúrbio da tiroide" },
    coach: "THYROÏDE : les repères habituels (VFC, FC repos) sont moins fiables. Fie-toi davantage au ressenti (RPE) et aux allures tenues. Progression plus lente à assumer, sans culpabiliser l'athlète." },
  { slug: "apnee", label: { fr: "Apnée du sommeil", en: "Sleep apnoea", de: "Schlafapnoe", es: "Apnea del sueño", pt: "Apneia do sono" },
    coach: "APNÉE DU SOMMEIL : un score de sommeil « correct » n'est PAS un repère fiable ici. Espace davantage les séances dures (72 h plutôt que 48 h) et limite l'accumulation de charge." },
  { slug: "migraines", label: { fr: "Migraines", en: "Migraines", de: "Migräne", es: "Migrañas", pt: "Enxaquecas" },
    coach: "MIGRAINES : hydratation et ravitaillement stricts sur les sorties longues, pas de fractionné en pleine chaleur. Une séance annulée lors d'une crise n'est pas un échec du plan." },
  { slug: "digestif", label: { fr: "Troubles digestifs", en: "Digestive issues", de: "Verdauungsprobleme", es: "Problemas digestivos", pt: "Problemas digestivos" },
    coach: "TROUBLES DIGESTIFS : la nutrition de course doit être TESTÉE à l'entraînement, jamais découverte le jour J ; les glucides s'introduisent progressivement, et les séances qualité se placent à distance des repas." },
  { slug: "allergies", label: { fr: "Allergies / rhinite", en: "Allergies / rhinitis", de: "Allergien / Rhinitis", es: "Alergias / rinitis", pt: "Alergias / rinite" },
    coach: "ALLERGIES : en saison pollinique, les grosses séances peuvent se décaler en fin de journée ou en intérieur. Une performance dégradée en avril-juin peut venir de là, pas d'un manque de forme." },
  { slug: "covid_long", label: { fr: "Covid long / fatigue post-virale", en: "Long Covid / post-viral fatigue", de: "Long Covid / postvirale Fatigue", es: "Covid persistente / fatiga posviral", pt: "Covid longa / fadiga pós-viral" },
    coach: "⚠️ FATIGUE POST-VIRALE : reprise TRÈS progressive, uniquement en Z1-Z2, aucune intensité tant que la VFC n'est pas remontée à sa base. Si l'athlète se sent plus mal 24-48 h APRÈS une séance, réduis immédiatement et oriente-le vers son médecin." },
  { slug: "grossesse", label: { fr: "Grossesse / post-partum", en: "Pregnancy / postpartum", de: "Schwangerschaft / postpartal", es: "Embarazo / posparto", pt: "Gravidez / pós-parto" },
    coach: "GROSSESSE / POST-PARTUM : le suivi médical décide, tu ne remplaces pas un avis obstétrical. Pilote à la sensation et à la conversation, PAS à la FC (elle est faussée). Pas d'effort maximal, pas de surchauffe. En post-partum : retour à la course seulement avec l'accord de sa sage-femme ou de son médecin, puis reprise très progressive." },
  { slug: "surpoids", label: { fr: "Surpoids", en: "Overweight", de: "Übergewicht", es: "Sobrepeso", pt: "Excesso de peso" },
    coach: "SURPOIDS : au début, privilégie le volume en marche rapide, vélo ou elliptique, la fréquence plutôt que la durée, et une progression lente. Ne parle JAMAIS de poids en termes de performance ou d'esthétique : parle régularité et plaisir." },
];

// ── Zones de blessure récurrentes ────────────────────────────────────────────
// Ce sont des antécédents (terrain fragile), pas une douleur actuelle. Les douleurs
// signalées au jour le jour arrivent séparément via le feedback de séance.
export const INJURY_ZONES: HealthItem[] = [
  { slug: "achille", label: { fr: "Tendon d'Achille / mollet", en: "Achilles / calf", de: "Achillessehne / Wade", es: "Tendón de Aquiles / gemelo", pt: "Tendão de Aquiles / gémeo" },
    coach: "ACHILLE/MOLLET (antécédent) : progression du VOLUME avant tout ajout d'intensité, pas de côtes ni de pliométrie sur une semaine chargée, pas de changement brusque de chaussures, prudence sur le sable." },
  { slug: "genou", label: { fr: "Genou / syndrome de l'essuie-glace", en: "Knee / IT band", de: "Knie / Tractus iliotibialis", es: "Rodilla / cintilla iliotibial", pt: "Joelho / banda iliotibial" },
    coach: "GENOU/ITB (antécédent) : limite les longues descentes et les dévers, pas d'augmentation brutale de la sortie longue." },
  { slug: "tibia", label: { fr: "Tibia / périostite", en: "Shin / shin splints", de: "Schienbein / Shin Splints", es: "Tibia / periostitis", pt: "Tíbia / periostite" },
    coach: "TIBIA (antécédent de périostite) : progression plafonnée à +5 %/semaine, alterne les surfaces (sentier, piste), vérifie l'usure des chaussures, et bascule sur du croisé (vélo, aqua-jogging) au moindre signal plutôt que d'attendre." },
  { slug: "ischio", label: { fr: "Ischio-jambiers", en: "Hamstrings", de: "Oberschenkelrückseite", es: "Isquiotibiales", pt: "Isquiotibiais" },
    coach: "ISCHIOS (antécédent) : jamais de sprint ni d'allure spécifique sur un échauffement écourté, lignes droites progressives avant toute séance rapide, prudence sur le fractionné en fin de séance quand la fatigue dégrade la foulée." },
  { slug: "hanche", label: { fr: "Hanche / psoas", en: "Hip / psoas", de: "Hüfte / Psoas", es: "Cadera / psoas", pt: "Anca / psoas" },
    coach: "HANCHE/PSOAS (antécédent) : prudence sur le fractionné court et les changements de rythme brusques." },
  { slug: "pied", label: { fr: "Pied / fasciite plantaire", en: "Foot / plantar fasciitis", de: "Fuß / Plantarfasziitis", es: "Pie / fascitis plantar", pt: "Pé / fascite plantar" },
    coach: "PIED (antécédent de fasciite plantaire) : évite les surfaces très dures, le sable sec, et la course pieds nus ou en minimaliste." },
  { slug: "dos", label: { fr: "Dos / lombaires", en: "Back / lower back", de: "Rücken / Lendenwirbel", es: "Espalda / lumbares", pt: "Costas / lombares" },
    coach: "DOS/LOMBAIRES (antécédent) : prudence sur les sorties longues avec sac et sur les descentes prolongées, pas de charge lourde en flexion du dos." },
  { slug: "fracture_fatigue", label: { fr: "Antécédent de fracture de fatigue", en: "Past stress fracture", de: "Frühere Ermüdungsfraktur", es: "Fractura de estrés previa", pt: "Fratura de stress anterior" },
    coach: "⚠️ ANTÉCÉDENT DE FRACTURE DE FATIGUE : c'est l'antécédent le plus lourd de conséquence. Progression STRICTEMENT ≤ +5 %/semaine, jamais deux semaines de hausse consécutives sans semaine allégée. Toute douleur osseuse localisée → arrêt de la course et avis médical, pas d'attentisme." },
];

/** Libellé traduit d'une entrée (repli sur le français si la langue manque). */
export const healthLabel = (item: HealthItem, lang: string) => item.label[lang] ?? item.label.fr;

/**
 * Consignes coach correspondant aux slugs stockés (ordre du catalogue, entrées inconnues
 * ignorées). Les `labels` renvoyés sont en français SANS emoji : ils partent dans le prompt
 * de l'IA, qui raisonne en français — l'UI, elle, passe par `healthLabel`.
 */
export function healthCoachLines(slugs: unknown, catalog: HealthItem[]): { labels: string[]; rules: string[] } {
  const set = new Set(Array.isArray(slugs) ? slugs.map(String) : []);
  const hits = catalog.filter((c) => set.has(c.slug));
  return { labels: hits.map((h) => h.label.fr.replace(/^\S+\s/, "")), rules: hits.map((h) => h.coach) };
}

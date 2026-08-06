// Catalogue santé partagé — UNE seule source de vérité pour les formulaires (onboarding,
// profil) ET pour le briefing du coach IA. Les slugs sont stockés en base (profiles.
// health_conditions / injury_zones) ; les libellés servent à l'UI ; les consignes `coach`
// sont injectées telles quelles dans le contexte de l'IA.
//
// Règle d'or : la santé prime sur la performance. Chaque consigne dit ce que le coach
// DOIT faire ou éviter, jamais un simple constat.

export type HealthItem = {
  slug: string;
  /** Libellé court affiché dans les puces du formulaire, traduit (repli : fr). */
  label: Record<string, string>;
  /** Consigne d'entraînement injectée dans le prompt du coach. */
  coach: string;
};

// ── Pathologies déclarées ────────────────────────────────────────────────────
export const HEALTH_CONDITIONS: HealthItem[] = [
  { slug: "asthme", label: { fr: "🫁 Asthme / asthme d'effort", en: "🫁 Asthma / exercise-induced", de: "🫁 Asthma / Belastungsasthma", es: "🫁 Asma / asma de esfuerzo", pt: "🫁 Asma / asma de esforço" },
    coach: "ASTHME D'EFFORT : échauffement RALLONGÉ et très progressif (20 min minimum — un démarrage brutal déclenche le bronchospasme), évite le fractionné court par temps froid et sec (le pire déclencheur) ou fais-le en intérieur, et rappelle-lui d'avoir son bronchodilatateur sur lui. Une gêne respiratoire qui persiste après l'effort = on arrête la séance, pas on la finit." },
  { slug: "cardiaque", label: { fr: "❤️ Antécédent cardiaque", en: "❤️ Heart condition history", de: "❤️ Herz-Vorgeschichte", es: "❤️ Antecedente cardíaco", pt: "❤️ Antecedente cardíaco" },
    coach: "⚠️ ANTÉCÉDENT CARDIAQUE : ne prescris AUCUNE séance maximale (VMA à 100 % et au-delà, test d'effort, sprints all-out) sans avis médical explicite. Reste en Z1-Z3, privilégie le volume facile et le seuil bas. Toute douleur thoracique, palpitation, essoufflement anormal ou malaise → ARRÊT immédiat et consultation. Dis-le-lui clairement plutôt que de contourner." },
  { slug: "hypertension", label: { fr: "🩺 Hypertension", en: "🩺 High blood pressure", de: "🩺 Bluthochdruck", es: "🩺 Hipertensión", pt: "🩺 Hipertensão" },
    coach: "HYPERTENSION : l'endurance en Z2 est bénéfique et doit être la base. Évite les efforts en apnée/blocage respiratoire (renfo très lourd, côtes ultra-raides en force max) qui font grimper la pression. Attention aux bêtabloquants s'il en prend : ils écrasent la FC → les zones cardiaques deviennent fausses, pilote alors à la sensation (RPE) et à l'allure." },
  { slug: "diabete", label: { fr: "🍬 Diabète", en: "🍬 Diabetes", de: "🍬 Diabetes", es: "🍬 Diabetes", pt: "🍬 Diabetes" },
    coach: "DIABÈTE : glycémie à contrôler avant/après séance, sucres rapides toujours sur soi. Les séances longues et le fractionné modifient la glycémie dans des sens opposés (hypo à retardement possible jusqu'à plusieurs heures après) — privilégie la régularité et les horaires stables plutôt que des séances imprévisibles. Surveillance des pieds impérative (ampoules et plaies cicatrisent mal)." },
  { slug: "anemie", label: { fr: "🩸 Anémie / carence en fer", en: "🩸 Anaemia / iron deficiency", de: "🩸 Anämie / Eisenmangel", es: "🩸 Anemia / falta de hierro", pt: "🩸 Anemia / falta de ferro" },
    coach: "CARENCE EN FER : c'est LA cause d'une stagnation inexpliquée avec FC anormalement haute en facile. Tant que le fer n'est pas corrigé, une charge élevée ne produira pas d'adaptation — allège, privilégie le volume facile et pousse-le à faire contrôler ferritine + hémoglobine. Ne mets pas sa fatigue sur le compte d'un manque de motivation." },
  { slug: "thyroide", label: { fr: "🦋 Trouble thyroïdien", en: "🦋 Thyroid disorder", de: "🦋 Schilddrüsenstörung", es: "🦋 Trastorno tiroideo", pt: "🦋 Distúrbio da tiroide" },
    coach: "THYROÏDE : le métabolisme, la FC de repos et la récupération sont perturbés — les repères habituels (VFC, FC repos) sont moins fiables. Fie-toi davantage au ressenti (RPE) et aux allures tenues. Progression plus lente à assumer, sans culpabiliser l'athlète." },
  { slug: "apnee", label: { fr: "😴 Apnée du sommeil", en: "😴 Sleep apnoea", de: "😴 Schlafapnoe", es: "😴 Apnea del sueño", pt: "😴 Apneia do sono" },
    coach: "APNÉE DU SOMMEIL : la récupération nocturne est fortement dégradée même quand la durée de sommeil paraît correcte — un score de sommeil « correct » n'est PAS fiable ici. Espace davantage les séances dures (72 h plutôt que 48 h) et limite l'accumulation de charge." },
  { slug: "migraines", label: { fr: "🤕 Migraines", en: "🤕 Migraines", de: "🤕 Migräne", es: "🤕 Migrañas", pt: "🤕 Enxaquecas" },
    coach: "MIGRAINES : déshydratation, chaleur, hypoglycémie et efforts maximaux sont des déclencheurs classiques. Hydratation et ravitaillement stricts sur les sorties longues, évite le fractionné en pleine chaleur. Une séance annulée pour cause de crise n'est pas un échec du plan." },
  { slug: "digestif", label: { fr: "🍽️ Troubles digestifs", en: "🍽️ Digestive issues", de: "🍽️ Verdauungsprobleme", es: "🍽️ Problemas digestivos", pt: "🍽️ Problemas digestivos" },
    coach: "TROUBLES DIGESTIFS : la nutrition de course doit être TESTÉE à l'entraînement, jamais découverte le jour J. Introduis les glucides progressivement (commence à 30 g/h), évite les fibres et les produits laitiers avant séance, et privilégie les séances qualité à distance des repas." },
  { slug: "allergies", label: { fr: "🌾 Allergies / rhinite", en: "🌾 Allergies / rhinitis", de: "🌾 Allergien / Rhinitis", es: "🌾 Alergias / rinitis", pt: "🌾 Alergias / rinite" },
    coach: "ALLERGIES : en saison pollinique, décale les séances en fin de journée (pics polliniques le matin) et privilégie l'intérieur ou les bords d'eau pour les grosses séances. Une performance dégradée en avril-juin peut venir de là, pas d'un manque de forme." },
  { slug: "covid_long", label: { fr: "🦠 Covid long / fatigue post-virale", en: "🦠 Long Covid / post-viral fatigue", de: "🦠 Long Covid / postvirale Fatigue", es: "🦠 Covid persistente / fatiga posviral", pt: "🦠 Covid longa / fadiga pós-viral" },
    coach: "⚠️ FATIGUE POST-VIRALE : le malaise post-effort est le risque n°1 — pousser aggrave durablement l'état. Reprise TRÈS progressive, uniquement en Z1-Z2, aucune intensité tant que la VFC n'est pas remontée à sa base. Si l'athlète se sent plus mal 24-48 h APRÈS une séance, c'est le signal d'alarme : réduis immédiatement." },
  { slug: "grossesse", label: { fr: "🤰 Grossesse / post-partum", en: "🤰 Pregnancy / postpartum", de: "🤰 Schwangerschaft / postpartal", es: "🤰 Embarazo / posparto", pt: "🤰 Gravidez / pós-parto" },
    coach: "GROSSESSE / POST-PARTUM : suivi médical indispensable, tu ne remplaces pas un avis obstétrical. Pilote à la sensation et à la conversation, PAS à la FC (elle est faussée). Pas d'effort maximal, pas de surchauffe. En post-partum : rééducation du périnée AVANT le retour à la course à impact, puis reprise très progressive." },
  { slug: "surpoids", label: { fr: "⚖️ Surpoids", en: "⚖️ Overweight", de: "⚖️ Übergewicht", es: "⚖️ Sobrepeso", pt: "⚖️ Excesso de peso" },
    coach: "SURPOIDS : les contraintes articulaires à l'impact sont majorées → privilégie le volume en marche rapide/vélo/elliptique au début, la fréquence plutôt que la durée, et surveille genoux/tibias/pieds. Ne parle JAMAIS de poids en termes de performance ou d'esthétique : parle santé, régularité et plaisir." },
];

// ── Zones de blessure récurrentes ────────────────────────────────────────────
// Ce sont des antécédents (terrain fragile), pas une douleur actuelle. Les douleurs
// signalées au jour le jour arrivent séparément via le feedback de séance.
export const INJURY_ZONES: HealthItem[] = [
  { slug: "achille", label: { fr: "🦶 Tendon d'Achille / mollet", en: "🦶 Achilles / calf", de: "🦶 Achillessehne / Wade", es: "🦶 Tendón de Aquiles / gemelo", pt: "🦶 Tendão de Aquiles / gémeo" },
    coach: "ACHILLE/MOLLET fragile : progression du VOLUME avant tout ajout d'intensité, pas de côtes ni de pliométrie sur une semaine chargée, drop des chaussures stable (un changement de drop est un déclencheur classique). Renforcement excentrique du mollet 2×/semaine en PRÉVENTIF, même sans douleur. Sur sable : très prudent, c'est la surface qui sollicite le plus l'Achille." },
  { slug: "genou", label: { fr: "🦵 Genou / syndrome de l'essuie-glace", en: "🦵 Knee / IT band", de: "🦵 Knie / Tractus iliotibialis", es: "🦵 Rodilla / cintilla iliotibial", pt: "🦵 Joelho / banda iliotibial" },
    coach: "GENOU/ITB fragile : limite les longues descentes et les dévers, augmente la cadence (viser 175-180 spm réduit nettement la charge articulaire), et renforce fessiers + moyen glutéal 2×/semaine — c'est la cause réelle derrière la plupart des douleurs latérales de genou. Évite les augmentations brutales de sortie longue." },
  { slug: "tibia", label: { fr: "🦴 Tibia / périostite", en: "🦴 Shin / shin splints", de: "🦴 Schienbein / Shin Splints", es: "🦴 Tibia / periostitis", pt: "🦴 Tíbia / periostite" },
    coach: "PÉRIOSTITE : surfaces dures et augmentations rapides de volume sont les déclencheurs. Plafonne la progression à +5 %/semaine, alterne les surfaces (sentier, piste), vérifie l'usure des chaussures, et bascule sur du croisé (vélo, aqua-jogging) au moindre signal plutôt que d'attendre." },
  { slug: "ischio", label: { fr: "🍖 Ischio-jambiers", en: "🍖 Hamstrings", de: "🍖 Oberschenkelrückseite", es: "🍖 Isquiotibiales", pt: "🍖 Isquiotibiais" },
    coach: "ISCHIOS fragiles : jamais de sprint ni d'allure spécifique sur un échauffement écourté — c'est là que ça claque. Lignes droites progressives obligatoires avant toute séance rapide, nordic curls / renforcement excentrique 2×/semaine, et prudence sur le fractionné en fin de séance quand la fatigue dégrade la foulée." },
  { slug: "hanche", label: { fr: "🕺 Hanche / psoas", en: "🕺 Hip / psoas", de: "🕺 Hüfte / Psoas", es: "🕺 Cadera / psoas", pt: "🕺 Anca / psoas" },
    coach: "HANCHE/PSOAS : mobilité des fléchisseurs et gainage à intégrer systématiquement, prudence sur le fractionné court (les changements de rythme sollicitent fort le psoas) et sur les longues positions assises avant séance." },
  { slug: "pied", label: { fr: "👣 Pied / fasciite plantaire", en: "👣 Foot / plantar fasciitis", de: "👣 Fuß / Plantarfasziitis", es: "👣 Pie / fascitis plantar", pt: "👣 Pé / fascite plantar" },
    coach: "PIED/FASCIITE : douleur typiquement maximale au réveil et aux premiers pas. Mobilité plantaire et renforcement du pied quotidiens, évite les surfaces très dures et le pieds-nus/minimaliste en phase sensible. Le sable sec est à proscrire ici." },
  { slug: "dos", label: { fr: "🧍 Dos / lombaires", en: "🧍 Back / lower back", de: "🧍 Rücken / Lendenwirbel", es: "🧍 Espalda / lumbares", pt: "🧍 Costas / lombares" },
    coach: "DOS/LOMBAIRES : gainage complet non négociable (2-3×/semaine), prudence sur les sorties longues avec sac et sur les descentes prolongées. Évite le renfo lourd en flexion de rachis." },
  { slug: "fracture_fatigue", label: { fr: "💥 Antécédent de fracture de fatigue", en: "💥 Past stress fracture", de: "💥 Frühere Ermüdungsfraktur", es: "💥 Fractura de estrés previa", pt: "💥 Fratura de stress anterior" },
    coach: "⚠️ ANTÉCÉDENT DE FRACTURE DE FATIGUE : c'est l'antécédent le plus lourd de conséquence. Progression STRICTEMENT ≤ +5 %/semaine, jamais deux semaines de hausse consécutives sans semaine allégée, et surveille la disponibilité énergétique (une alimentation insuffisante est le facteur de risque n°1, avant même la charge). Toute douleur osseuse localisée et ponctuelle (qu'on peut désigner du doigt) → arrêt de la course et imagerie, pas d'attentisme." },
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

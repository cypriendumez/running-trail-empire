/**
 * COMBIEN DE CLIENTS TIENT LE PALIER GRATUIT ?
 *
 * Le plafond journalier n'est plus publié par Google : il dépend du projet et se lit sur
 * https://aistudio.google.com/rate-limit . Ce script ne l'invente donc pas — il le prend
 * en paramètre et fait l'arithmétique.
 *
 *   npx tsx tools/capacite-ia.ts               (hypothèses par défaut)
 *   npx tsx tools/capacite-ia.ts 250 1000 200  (tes vrais RPD : flash, flash-lite, 2.0)
 *
 * CE QUI CONSOMME DU QUOTA, vérifié dans le code le 08/08/2026 :
 *   · /api/ai/coach, /physio, /cours, /support, /journal-analyze, /session, /training-plan
 *   · les routes /api/admin/* (toi seul)
 * CE QUI N'EN CONSOMME PAS — et c'est l'essentiel :
 *   · le coach autonome nocturne (autoCoach + autoPlan sont DÉTERMINISTES, aucun LLM) ;
 *   · la synchronisation des activités, le calendrier, les allures, le mode poids.
 * Autrement dit : un client qui utilise son plan sans jamais discuter avec une IA coûte
 * ZÉRO requête. Seule la conversation coûte.
 */

const [a, b, c] = process.argv.slice(2).map(Number);
// Valeurs par défaut : ordre de grandeur souvent rapporté pour le palier gratuit, à
// remplacer par les tiennes. Elles ne sortent PAS d'une documentation officielle.
const RPD = { "gemini-2.5-flash": a || 250, "gemini-2.5-flash-lite": b || 1000, "gemini-2.0-flash": c || 200 };
const total = Object.values(RPD).reduce((s, n) => s + n, 0);
const source = a ? "tes valeurs" : "hypothèses à vérifier sur aistudio.google.com/rate-limit";

/** Profils d'usage : requêtes IA par client et par JOUR. */
const PROFILS = [
  { nom: "Passif — suit son plan, ne discute jamais", parJour: 0 },
  { nom: "Occasionnel — 1 question par mois", parJour: 1 / 30 },
  { nom: "Normal — 1 question par semaine", parJour: 1 / 7 },
  { nom: "Engagé — 3 questions par semaine", parJour: 3 / 7 },
  { nom: "Intensif — 2 questions par jour", parJour: 2 },
];

const fmt = (n: number) => (n >= 1e6 ? "illimité en pratique" : Math.floor(n).toLocaleString("fr-FR"));

console.log(`\nQuota journalier total : ${total.toLocaleString("fr-FR")} requêtes  (${source})`);
for (const [m, v] of Object.entries(RPD)) console.log(`   ${m.padEnd(24)} ${String(v).padStart(5)}`);

console.log(`\nCLIENTS SIMULTANÉMENT ACTIFS SUPPORTÉS`);
console.log(`   ${"profil d'usage".padEnd(46)} ${"clients max".padStart(12)}`);
for (const p of PROFILS) {
  const max = p.parJour === 0 ? Infinity : total / p.parJour;
  console.log(`   ${p.nom.padEnd(46)} ${fmt(max).padStart(12)}`);
}

// Répartition réaliste : la majorité des clients ne parle jamais à l'IA.
const MIX = [
  { part: 0.60, parJour: 0 },      // passifs
  { part: 0.25, parJour: 1 / 30 }, // occasionnels
  { part: 0.12, parJour: 1 / 7 },  // normaux
  { part: 0.03, parJour: 2 },      // intensifs
];
const moyenne = MIX.reduce((s, x) => s + x.part * x.parJour, 0);
console.log(`\nEN BASE DE CLIENTS RÉALISTE (60 % passifs, 25 % occasionnels, 12 % normaux, 3 % intensifs)`);
console.log(`   consommation moyenne : ${moyenne.toFixed(3)} requête/client/jour`);
console.log(`   → environ ${fmt(total / moyenne)} clients avant saturation du palier gratuit`);

console.log(`\n⚠️  CE QUE CE CALCUL NE DIT PAS`);
console.log(`   · Le plafond PAR MINUTE (RPM) saute bien avant le plafond journalier :`);
console.log(`     quelques clients qui posent une question en même temps suffisent.`);
console.log(`     C'est lui qui te limitera en premier, pas le nombre total de clients.`);
console.log(`   · Une journée moyenne ne dit rien d'un pic (lundi matin, sortie d'un plan).`);
console.log(`   · Le repli sans IA du support absorbe la panne côté aide — le coach IA,`);
console.log(`     le Kiné IA et les Cours, eux, n'ont aucun filet.\n`);

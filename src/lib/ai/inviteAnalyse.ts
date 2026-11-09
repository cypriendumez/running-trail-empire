// ─────────────────────────────────────────────────────────────────────────────
//  LA CONSIGNE DE L'ANALYSE D'UNE SÉANCE — ce que le modèle reçoit, et RIEN d'autre.
//
//  Sortie de la route (31/10/2026) pour être crash-testable : on peut fabriquer la consigne
//  pour chaque niveau d'athlète, chaque formule et chaque langue, et vérifier qu'aucun
//  « NaN », « undefined » ni chiffre absent n'y entre — sans appeler de modèle.
// ─────────────────────────────────────────────────────────────────────────────
import { allureTexte, dateLisible, TYPE_COURSE, type FaitsSeance } from "@/lib/ai/analyseSeance";
import { FOURCHETTE_QUALITE_SEC } from "@/lib/watch/intervals";
import { SPORT_LABEL, type Sport } from "@/lib/intervals/sport";

/** Les sports qui se mesurent en VITESSE (km/h) : une allure au kilomètre n'y a pas de sens. */
const EN_VITESSE = new Set(["bike", "ski", "row"]);
/** Les sports qui se mesurent à l'allure au kilomètre ; la natation, aux 100 m. Les autres
 *  (renforcement, mobilité…) n'ont ni allure ni vitesse. */
const EN_ALLURE = new Set(["run", "walk", "hike"]);
import type { Lang } from "@/lib/i18n/translations";

/**
 * Les faits transmis au modèle.
 *
 * ⚠️ C'EST ICI QUE SE JOUE L'ÉCART STARTER / PREMIUM, et il ne peut pas être une simple
 * longueur de texte. Une analyse « plus longue » sur les mêmes données, c'est du
 * remplissage : le client à 14,99 € paierait des phrases, pas du service.
 *
 * Starter reçoit la lecture ESSENTIELLE — ce qui s'est passé, à quelle intensité réelle,
 * et ce qui était prescrit. Premium (`analyse_complete`, réservée à Premium et à l'essai
 * depuis le 30/10/2026 : « le Premium doit tout analyser ») reçoit TOUT ce que la montre a
 * mesuré : le détail zone par zone, la cadence, la foulée (puissance, temps de contact,
 * oscillation, longueur), la dérive cardiaque, la température, et le rang parmi les
 * séances semblables. Ce sont des dimensions d'analyse en plus, pas des mots en plus.
 *
 * Et c'est le bon sens économique : les jetons d'ENTRÉE coûtent huit fois moins que ceux
 * de sortie. Donner plus de contexte à Premium coûte presque rien ; le laisser écrire
 * beaucoup plus, si.
 */
export function lignesDeFaits(f: FaitsSeance, lang: Lang, complet: boolean): string {
  const l: string[] = [];
  // ⚠️ Une date en toutes lettres, pas « 2026-08-24 » : le modèle RECOPIE ce qu'on lui
  // donne, et il servait la date brute à l'athlète — un entraîneur ne parle pas ainsi.
  // Le sport en toutes lettres : le modèle RECOPIE ce qu'on lui donne, et écrivait « run ».
  l.push(`Date : ${dateLisible(f.date, lang)} — ${SPORT_LABEL[f.sport as Sport] ?? SPORT_LABEL.other}`);
  if (f.distanceKm != null && f.dureeMin != null) l.push(`Distance ${f.distanceKm} km en ${f.dureeMin} min`);
  // ⚠️ L'ALLURE AU KILOMÈTRE NE VAUT QUE POUR LA COURSE, LA MARCHE ET LA RANDONNÉE. Une sortie
  // vélo à 30 km/h était décrite « Allure 2'00/km » : le modèle commentait une allure de course.
  if (EN_ALLURE.has(f.sport)) {
    const a = allureTexte(f.allure), ac = f.sport === "run" ? allureTexte(f.allureCorrigee) : null;
    if (a) l.push(`Allure ${a}/km${ac && ac !== a ? ` (corrigée du dénivelé : ${ac}/km)` : ""}`);
  } else if (EN_VITESSE.has(f.sport) && f.distanceKm != null && f.dureeMin) {
    l.push(`Vitesse moyenne ${new Intl.NumberFormat("fr", { maximumFractionDigits: 1 }).format(f.distanceKm / (f.dureeMin / 60))} km/h`);
  } else if (f.sport === "swim" && f.distanceKm && f.dureeMin) {
    const sec100 = Math.round((f.dureeMin * 60) / (f.distanceKm * 10));
    l.push(`Allure ${Math.floor(sec100 / 60)}'${String(sec100 % 60).padStart(2, "0")}/100 m`);
  }
  if (f.fcMoy != null) l.push(`FC moyenne ${f.fcMoy}${f.fcMax != null ? `, max ${f.fcMax}` : ""}${f.partFcMax != null ? ` — ${f.partFcMax} % de sa FC max` : ""}`);
  if (f.intensite) l.push(`Intensité RÉELLE, jugée à la fréquence cardiaque : ${f.intensite === "dure" ? "séance dure" : f.intensite === "moderee" ? "modérée" : "footing facile"}`);
  if (f.dplus != null) l.push(`Dénivelé positif ${f.dplus} m`);
  // ── Réservé à la formule haute : les dimensions d'analyse supplémentaires. ──
  if (complet) {
    // Les nombres dans la langue de l'athlète : le modèle RECOPIE « 1.12 m » tel quel.
    const nf = (x: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(x);
    if (f.zonesMin) l.push(`Temps en zones (minutes, mesuré par la montre) : ${f.zonesMin.map((m, i) => `Z${i + 1} ${m}`).join(" · ")}`);
    if (f.cadence != null) l.push(`Cadence ${f.cadence} pas/min`);
    const fo = f.foulee;
    const foulee = [
      fo.puissanceW != null ? `puissance ${Math.round(fo.puissanceW)} W` : null,
      fo.contactSolMs != null ? `temps de contact au sol ${Math.round(fo.contactSolMs)} ms` : null,
      fo.oscillationCm != null ? `oscillation verticale ${nf(fo.oscillationCm)} cm` : null,
      fo.longueurM != null ? `longueur de foulée ${nf(fo.longueurM)} m` : null,
    ].filter(Boolean);
    if (foulee.length) l.push(`Foulée (mesurée par la montre) : ${foulee.join(" · ")}`);
    if (f.derive != null) l.push(`Dérive cardiaque ${f.derive > 0 ? "+" : ""}${nf(f.derive)} % (repère : sous 5 %, l'endurance tient ; au-delà, elle cède)`);
    // Les répétitions une par une, et l'écart CHIFFRÉ à la séance prévue (calculés, jamais estimés).
    const fr = (sec: number) => allureTexte(sec / 60);
    // Le contexte du jour : ce qui explique une séance au-delà de ses chiffres.
    if (f.contexte) {
      const c = f.contexte;
      if (c.ressenti) l.push(`Ressenti déclaré pour cette séance : ${c.ressenti.rpe}/10${c.signalRessenti === "fatigue" ? " — dur pour une intensité cardiaque facile : SIGNAL DE FATIGUE" : c.signalRessenti === "facilite" ? " — facile pour une séance cardiaquement dure : grande fraîcheur, ou FC max sous-estimée" : ""}`);
      if (c.nuit) l.push(`Nuit précédente : ${[c.nuit.score != null ? `score ${c.nuit.score}/100` : null, c.nuit.minutes != null ? `${Math.floor(c.nuit.minutes / 60)} h ${String(c.nuit.minutes % 60).padStart(2, "0")} de sommeil` : null].filter(Boolean).join(", ")}`);
      if (c.vfc) l.push(`VFC du matin : ${c.vfc.matin} ms${c.vfc.base != null ? `, contre ${c.vfc.base} ms de moyenne les jours précédents (${c.vfc.matin >= c.vfc.base ? "+" : ""}${Math.round((c.vfc.matin / c.vfc.base - 1) * 100)} %)` : ""}`);
      if (c.forme) l.push(`Fraîcheur la veille (modèle de charge) : ${c.forme.tsb > 0 ? "+" : ""}${c.forme.tsb} (forme ${c.forme.ctl}, fatigue ${c.forme.atl})`);
    }
    if (f.progression) {
      const pr = f.progression, classe = pr.classe === "facile" ? "faciles" : pr.classe === "moderee" ? "modérées" : "dures";
      l.push(`Progression : efficacité (vitesse par battement) ${pr.ecartPct > 0 ? "+" : ""}${pr.ecartPct} % par rapport à la médiane de tes ${pr.n} séances ${classe} de distance comparable des 12 dernières semaines`);
    }
    if (f.trail) {
      const t = f.trail;
      if (t.montees.nombre) l.push(`En montée (pentes de 4 % et plus) : ${t.montees.nombre} montée(s), ${t.montees.dPlus} m de D+ en ${t.montees.minutes} min${t.montees.vam != null ? ` — vitesse ascensionnelle ${t.montees.vam} m/h` : ""}${t.montees.fc != null ? `, FC moyenne ${t.montees.fc}` : ""}`);
      if (t.descentes.nombre) l.push(`En descente (pentes de −4 % et moins) : ${t.descentes.nombre} descente(s), ${t.descentes.dMoins} m de D− sur ${t.descentes.km} km${t.descentes.allureSec != null ? ` à ${fr(t.descentes.allureSec)}/km` : ""}${t.descentes.fc != null ? `, FC moyenne ${t.descentes.fc}` : ""}`);
    }
    if (f.zoneVisee) {
      const z = f.zoneVisee;
      l.push(`Zone visée Z${z.zone} : ${z.minutesDans} min dedans sur ${z.minutesTotal} min de séance${z.minutesTotal > 0 ? ` (${Math.round((z.minutesDans / z.minutesTotal) * 100)} %)` : ""}, ${z.minutesAuDessus} min au-dessus`);
    }
    if (f.repetitions) {
      const d = f.repetitions.decrochageSec;
      l.push(`Répétitions relevées par la montre : ${f.repetitions.allures.length} — allures ${f.repetitions.allures.map(fr).join(" · ")} /km${f.repetitions.fcMoy != null ? `, FC moyenne ${f.repetitions.fcMoy}` : ""} ; du premier au dernier tiers : ${d > 0 ? `+${d} s/km (ralentissement)` : d < 0 ? `${d} s/km (accélération)` : "allure tenue"}`);
    }
    if (f.ecart) {
      const e = f.ecart;
      const ecart = e.ecartSec === 0 ? "pile à l'allure prévue" : `${Math.abs(e.ecartSec)} s/km ${e.ecartSec > 0 ? "plus lent" : "plus vite"} que prévu`;
      const cible = `${fr(e.allureCibleSec)}/km${e.alternance ? ` de moyenne (en alternant ${fr(e.alternance[0])} et ${fr(e.alternance[1])})` : ""}`;
      // Un nombre de répétitions très différent du prévu : la séance courue n'est pas celle prévue.
      const structure = e.repsPrevues != null && e.repsFaites != null && e.repsFaites > 0
        && Math.abs(e.repsFaites - e.repsPrevues) > Math.max(1, e.repsPrevues * 0.3)
        ? " — la séance courue ne suit pas la structure prévue" : "";
      if (e.sur === "repetitions") l.push(`Écart à la séance prévue : ${e.repsPrevues} répétitions prévues à ${cible}, ${e.repsFaites} relevées${structure}, en moyenne à ${fr(e.allureFaiteSec)}/km (${ecart})${e.dansLaFourchette != null ? ` ; ${e.dansLaFourchette} sur ${e.repsFaites} dans la fourchette affichée par la montre (±${FOURCHETTE_QUALITE_SEC} s/km)` : ""}`);
      else if (e.sur === "bloc" && e.repsPrevues) l.push(`Écart à la séance prévue : au lieu des ${e.repsPrevues} répétitions prévues à ${cible}, la montre a relevé un effort continu de ${e.blocMin} min${e.tours ? ` (${e.tours.length} tours : ${e.tours.map(fr).join(" · ")} /km)` : ""}, couru en moyenne à ${fr(e.allureFaiteSec)}/km — ce n'est pas la séance prévue, ne juge pas le fractionné`);
      else if (e.sur === "bloc") l.push(`Écart à la séance prévue : corps de séance (${e.blocMin} min${e.tours ? `, découpé par la montre en ${e.tours.length} tours : ${e.tours.map(fr).join(" · ")} /km` : ""}) couru en moyenne à ${fr(e.allureFaiteSec)}/km pour ${fr(e.allureCibleSec)}/km prévus (${ecart})`);
      else l.push(`Écart à la séance prévue : ${fr(e.allureFaiteSec)}/km pour ${fr(e.allureCibleSec)}/km prévus (${ecart})`);
    }
    if (f.tempC != null) l.push(`Température ${f.tempC} °C`);
    if (f.rang) l.push(`Parmi ses séances de distance comparable : ${f.rang.place}ᵉ sur ${f.rang.total}`);
  }
  // Le jour de la course visée, il n'y a pas d'entraînement prescrit : il y a la course. Le dire
  // explicitement, sinon le modèle juge un marathon « trop intense » (25/10/2026, Lille).
  if (f.prescrit?.type === TYPE_COURSE) l.push(`C'ÉTAIT LA COURSE VISÉE CE JOUR-LÀ${f.prescrit.titre ? ` : ${f.prescrit.titre}` : ""}. Juge-la comme une course, où un effort maximal est attendu : jamais comme un entraînement trop intense, et ne la compare à aucune séance d'entraînement prévue`);
  else if (f.prescrit) l.push(`Ce qui était PRESCRIT ce jour-là : ${f.prescrit.type}${f.prescrit.titre ? ` — ${f.prescrit.titre}` : ""}`);
  if (f.manques.length) l.push(`CE QU'ON NE SAIT PAS (à dire, jamais à combler) : ${f.manques.join(" ; ")}`);
  return l.join("\n");
}

/** La langue de rédaction : celle du compte, jamais le français en dur. */
const LANGUE: Record<Lang, string> = {
  fr: "en français, en tutoyant", en: "in English, addressing the athlete as “you”",
  de: "auf Deutsch, mit Du-Anrede", es: "en español, tuteando",
  pt: "em português, tratando o atleta por tu",
};

/** La consigne complète : règles, structure selon la formule, et les faits. */
export function inviteAnalyse(faits: FaitsSeance, lang: Lang, complet: boolean): string {
  return [
    "Tu es l'entraîneur de cet athlète et tu relis UNE de ses séances.",
    "",
    "RÈGLES ABSOLUES :",
    "- N'écris AUCUN chiffre qui ne figure pas ci-dessous. Aucune estimation, aucun ordre de grandeur.",
    "- Ce qui est listé comme inconnu doit être DIT inconnu, jamais comblé.",
    ...(faits.exploitable ? [] : [
      "- ⚠️ CETTE SÉANCE N'EST PAS INTERPRÉTABLE (voir ce qu'on ne sait pas). Dis-le en une",
      "  ou deux phrases, explique ce qui manque, et N'EN TIRE AUCUNE CONCLUSION sur sa forme.",
      "  Ne commente ni la chaleur, ni la gestion de l'effort, ni quoi que ce soit d'autre.",
    ]),
    "- Juge l'intensité sur la fréquence cardiaque fournie, jamais sur le titre de la séance.",
    "- Pas de diagnostic médical, pas de « tu es apte ».",
    `- ${complet ? "Six à huit phrases" : "Trois à quatre phrases"}, ${LANGUE[lang]}.`,
    "- Commence directement par le fond : pas de salutation, pas de « je viens de relire ». Chaque mot est facturé.",
    "",
    complet
      ? "STRUCTURE : ce qui s'est passé · la séance prévue face à la séance faite (répétitions, allures, écart chiffré), quand c'est fourni · le contexte du jour (ressenti, nuit, VFC, fraîcheur) quand il explique la séance · la répartition de l'effort et ce qu'elle révèle · ce que disent la foulée et la dérive cardiaque, quand elles sont fournies · comment cette séance se situe par rapport à ses semblables · ce que ça dit de sa forme · une chose à retenir."
      : "STRUCTURE : ce qui s'est passé · ce que ça dit de sa forme · une seule chose à retenir pour la suite.",
    "",
    "LES FAITS :",
    lignesDeFaits(faits, lang, complet),
  ].join("\n");
}

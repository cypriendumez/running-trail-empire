"use client";

/**
 * NUTRITION DE COURSE — Santé › Nutrition, refaite le 30/09/2026.
 *
 * Cyprien : « ça fait beaucoup trop IA ; fais plus intuitif, comme les applications pro
 * qui s'occupent de la nourriture ; mets-toi à la place des clients ». L'ancien écran —
 * « Nutrition Lab », quatre tuiles en dégradé avec émojis, un tableau H+1…H+6 identique à
 * chaque ligne — posait deux curseurs abstraits et affichait des chiffres INVENTÉS sur
 * place (« 120 mg de caféine », « 40 g/h + 5 g par heure au-delà de 3 h ») qui ne disaient
 * pas la même chose que le coach.
 *
 * Désormais on part de ce que le coureur connaît : SA course (la durée est celle que le
 * coach prédit depuis la VMA, `lib/health/coursesNutrition`) et la météo en mots. L'écran
 * ne décide RIEN : il lit `planNutritionCourse` et `derouleCourse`, puis répond aux trois
 * questions qu'on se pose vraiment — combien par heure, quoi mettre dans le sac, quand.
 */
import { useId, useMemo, useState } from "react";
import { Check, Droplets, Flame, Clock, Utensils, Info } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { planNutritionCourse, derouleCourse, TRANCHES_TEMPERATURE, GEL_G, FLASQUE_ML, DUREE_MIN_MIN, type TrancheTemperature } from "@/lib/coach/nutritionCourse";
import type { CourseNutri } from "@/lib/health/coursesNutrition";
import { formatDateCivile } from "@/lib/time/fuseau";

const TX: Record<string, Record<string, string>> = {
  fr: {
    titre: "Nutrition de course", sous: "Quoi manger et boire, calculé sur ta course — les mêmes chiffres que ton coach.",
    course: "Ta course", autre: "Autre durée", duree: "Durée de l'effort", predite: "prédite", visee: "visée", sansDuree: "durée inconnue",
    meteo: "Météo le jour J", nsp: "Je ne sais pas", frais: "Frais", doux: "Doux", chaud: "Chaud", tresChaud: "Très chaud", canicule: "Canicule",
    court: "Moins de {d} d'effort : tes réserves suffisent. Bois à ta soif, rien à manger pendant la course.",
    parHeure: "Par heure", glucides: "Glucides", boisson: "Boisson", sodium: "Sodium",
    sac: "Dans ton sac", gels: "{n} gels de {g} g", gel1: "1 gel de {g} g", flasques: "{n} flasques de {ml} ml (ou les ravitaillements)", flasque1: "1 flasque de {ml} ml (ou les ravitaillements)",
    sel: "{mg} mg de sodium au total (pastilles ou boisson d'effort)",
    deroule: "Le déroulé", avant: "Avant", pendant: "Pendant", apres: "Après",
    avantPoids: "La veille et le matin : environ {g} g de glucides (pâtes, riz, pain, fruits). Dernier repas 3 h avant le départ.",
    avantSans: "La veille : un repas riche en glucides. Le matin : un petit-déjeuner que tu connais, 3 h avant le départ.",
    prise: "1 gel + {ml} ml", puis: "… puis toutes les {n} min jusqu'à l'arrivée",
    boire: "Bois par petites gorgées dès le départ, sans attendre la soif.",
    apresTxt: "Dans l'heure : boire, puis un repas avec glucides et protéines.",
    tempInconnue: "Base tempérée : choisis la météo pour ajuster la boisson et le sel.",
    source: "Repères issus des recommandations de nutrition sportive (glucides 50 à 75 g/h selon la durée).",
  },
  en: {
    titre: "Race nutrition", sous: "What to eat and drink, worked out for your race — the same figures as your coach.",
    course: "Your race", autre: "Other duration", duree: "Effort duration", predite: "predicted", visee: "target", sansDuree: "unknown duration",
    meteo: "Race-day weather", nsp: "I don't know", frais: "Cool", doux: "Mild", chaud: "Warm", tresChaud: "Hot", canicule: "Heatwave",
    court: "Under {d} of effort: your reserves are enough. Drink to thirst, nothing to eat during the race.",
    parHeure: "Per hour", glucides: "Carbs", boisson: "Fluids", sodium: "Sodium",
    sac: "In your bag", gels: "{n} gels of {g} g", gel1: "1 gel of {g} g", flasques: "{n} soft flasks of {ml} ml (or the aid stations)", flasque1: "1 soft flask of {ml} ml (or the aid stations)",
    sel: "{mg} mg of sodium in total (tablets or sports drink)",
    deroule: "Timeline", avant: "Before", pendant: "During", apres: "After",
    avantPoids: "The day before and in the morning: about {g} g of carbs (pasta, rice, bread, fruit). Last meal 3 h before the start.",
    avantSans: "The day before: a carb-rich meal. In the morning: a breakfast you know, 3 h before the start.",
    prise: "1 gel + {ml} ml", puis: "… then every {n} min until the finish",
    boire: "Sip from the start, without waiting to be thirsty.",
    apresTxt: "Within the hour: drink, then a meal with carbs and protein.",
    tempInconnue: "Mild-weather baseline: pick the weather to adjust fluids and salt.",
    source: "Based on sports nutrition guidelines (50 to 75 g of carbs per hour depending on duration).",
  },
  de: {
    titre: "Wettkampfernährung", sous: "Was du essen und trinken solltest, berechnet für dein Rennen — dieselben Zahlen wie dein Coach.",
    course: "Dein Rennen", autre: "Andere Dauer", duree: "Belastungsdauer", predite: "prognostiziert", visee: "Ziel", sansDuree: "Dauer unbekannt",
    meteo: "Wetter am Renntag", nsp: "Weiß ich nicht", frais: "Kühl", doux: "Mild", chaud: "Warm", tresChaud: "Heiß", canicule: "Hitzewelle",
    court: "Unter {d} Belastung reichen deine Reserven. Trink nach Durst, während des Rennens nichts essen.",
    parHeure: "Pro Stunde", glucides: "Kohlenhydrate", boisson: "Flüssigkeit", sodium: "Natrium",
    sac: "In deinem Rucksack", gels: "{n} Gels à {g} g", gel1: "1 Gel à {g} g", flasques: "{n} Soft Flasks à {ml} ml (oder die Verpflegungsstellen)", flasque1: "1 Soft Flask à {ml} ml (oder die Verpflegungsstellen)",
    sel: "{mg} mg Natrium insgesamt (Tabletten oder Sportgetränk)",
    deroule: "Ablauf", avant: "Vorher", pendant: "Währenddessen", apres: "Danach",
    avantPoids: "Am Vortag und am Morgen: etwa {g} g Kohlenhydrate (Nudeln, Reis, Brot, Obst). Letzte Mahlzeit 3 h vor dem Start.",
    avantSans: "Am Vortag: eine kohlenhydratreiche Mahlzeit. Am Morgen: ein gewohntes Frühstück, 3 h vor dem Start.",
    prise: "1 Gel + {ml} ml", puis: "… dann alle {n} min bis ins Ziel",
    boire: "Trink ab dem Start in kleinen Schlucken, ohne auf den Durst zu warten.",
    apresTxt: "Innerhalb einer Stunde: trinken, dann eine Mahlzeit mit Kohlenhydraten und Eiweiß.",
    tempInconnue: "Basis für mildes Wetter: Wähle das Wetter, um Flüssigkeit und Salz anzupassen.",
    source: "Nach den Empfehlungen der Sporternährung (50 bis 75 g Kohlenhydrate pro Stunde je nach Dauer).",
  },
  es: {
    titre: "Nutrición de carrera", sous: "Qué comer y beber, calculado para tu carrera — las mismas cifras que tu coach.",
    course: "Tu carrera", autre: "Otra duración", duree: "Duración del esfuerzo", predite: "prevista", visee: "objetivo", sansDuree: "duración desconocida",
    meteo: "Tiempo el día D", nsp: "No lo sé", frais: "Fresco", doux: "Templado", chaud: "Caluroso", tresChaud: "Muy caluroso", canicule: "Ola de calor",
    court: "Menos de {d} de esfuerzo: tus reservas bastan. Bebe según la sed, nada que comer durante la carrera.",
    parHeure: "Por hora", glucides: "Carbohidratos", boisson: "Bebida", sodium: "Sodio",
    sac: "En tu mochila", gels: "{n} geles de {g} g", gel1: "1 gel de {g} g", flasques: "{n} bidones blandos de {ml} ml (o los avituallamientos)", flasque1: "1 bidón blando de {ml} ml (o los avituallamientos)",
    sel: "{mg} mg de sodio en total (pastillas o bebida isotónica)",
    deroule: "El desarrollo", avant: "Antes", pendant: "Durante", apres: "Después",
    avantPoids: "La víspera y por la mañana: unos {g} g de carbohidratos (pasta, arroz, pan, fruta). Última comida 3 h antes de la salida.",
    avantSans: "La víspera: una comida rica en carbohidratos. Por la mañana: un desayuno conocido, 3 h antes de la salida.",
    prise: "1 gel + {ml} ml", puis: "… y luego cada {n} min hasta la meta",
    boire: "Bebe a sorbos desde la salida, sin esperar a tener sed.",
    apresTxt: "En la hora siguiente: bebe y luego una comida con carbohidratos y proteínas.",
    tempInconnue: "Base templada: elige el tiempo para ajustar bebida y sal.",
    source: "Basado en las recomendaciones de nutrición deportiva (50 a 75 g de carbohidratos por hora según la duración).",
  },
  pt: {
    titre: "Nutrição de prova", sous: "O que comer e beber, calculado para a tua prova — os mesmos números do teu coach.",
    course: "A tua prova", autre: "Outra duração", duree: "Duração do esforço", predite: "prevista", visee: "objetivo", sansDuree: "duração desconhecida",
    meteo: "Tempo no dia da prova", nsp: "Não sei", frais: "Fresco", doux: "Ameno", chaud: "Quente", tresChaud: "Muito quente", canicule: "Onda de calor",
    court: "Menos de {d} de esforço: as tuas reservas chegam. Bebe conforme a sede, nada para comer durante a prova.",
    parHeure: "Por hora", glucides: "Hidratos", boisson: "Bebida", sodium: "Sódio",
    sac: "Na tua mochila", gels: "{n} géis de {g} g", gel1: "1 gel de {g} g", flasques: "{n} flasks de {ml} ml (ou os abastecimentos)", flasque1: "1 flask de {ml} ml (ou os abastecimentos)",
    sel: "{mg} mg de sódio no total (pastilhas ou bebida desportiva)",
    deroule: "O desenrolar", avant: "Antes", pendant: "Durante", apres: "Depois",
    avantPoids: "Na véspera e de manhã: cerca de {g} g de hidratos (massa, arroz, pão, fruta). Última refeição 3 h antes da partida.",
    avantSans: "Na véspera: uma refeição rica em hidratos. De manhã: um pequeno-almoço habitual, 3 h antes da partida.",
    prise: "1 gel + {ml} ml", puis: "… e depois a cada {n} min até à meta",
    boire: "Bebe aos golinhos desde a partida, sem esperar pela sede.",
    apresTxt: "Na hora seguinte: bebe e depois uma refeição com hidratos e proteína.",
    tempInconnue: "Base amena: escolhe o tempo para ajustar a bebida e o sal.",
    source: "Com base nas recomendações de nutrição desportiva (50 a 75 g de hidratos por hora conforme a duração).",
  },
};

/** Durées proposées quand l'athlète choisit « Autre durée » (en minutes). */
const DUREES = [45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600, 720, 900, 1080, 1440];
/** Au-delà, la liste des prises devient un mur : on montre les premières, puis la règle. */
const PRISES_VISIBLES = 8;

/** « 45 min », « 1 h 15 », « 3 h ». */
export function duree(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export function NutritionCourse({ courses = [], poidsKg = null }: { courses?: CourseNutri[]; poidsKg?: number | null }) {
  const { lang } = useT();
  const t = (k: string, p?: Record<string, string | number>) => {
    let s = TX[lang]?.[k] ?? TX.fr[k] ?? k;
    for (const [c, v] of Object.entries(p ?? {})) s = s.split(`{${c}}`).join(String(v));
    return s;
  };
  const id = useId();
  const avecDuree = courses.filter((c) => c.dureeSec != null);
  // Par défaut : la prochaine course dont on connaît la durée, sinon « Autre durée ».
  const [choix, setChoix] = useState<number>(avecDuree.length ? courses.indexOf(avecDuree[0]) : -1);
  const [dureeLibre, setDureeLibre] = useState(180);
  const [tranche, setTranche] = useState<TrancheTemperature | null>(null);
  const [coches, setCoches] = useState<Record<string, boolean>>({});

  const course = choix >= 0 ? courses[choix] : null;
  const dureeSec = course?.dureeSec ?? dureeLibre * 60;
  const tempC = tranche ? TRANCHES_TEMPERATURE.find((x) => x.cle === tranche)!.tempC : null;
  const plan = useMemo(() => planNutritionCourse({ dureeSec, distanceKm: course?.distanceKm ?? null, poidsKg, tempC }), [dureeSec, course, poidsKg, tempC]);
  const d = plan ? derouleCourse(plan) : null;

  const puce = (actif: boolean) => `inline-flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors ${
    actif ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"}`;
  const libelleTranche = (x: (typeof TRANCHES_TEMPERATURE)[number]) =>
    `${t(x.cle)} · ${x.min == null ? `< ${x.max! + 1}` : x.max == null ? `≥ ${x.min}` : `${x.min}–${x.max}`} °C`;
  const sac = d && plan ? [
    { k: "gels", txt: plan.gels === 1 ? t("gel1", { g: GEL_G }) : t("gels", { n: plan.gels, g: GEL_G }), montrer: plan.gels > 0 },
    { k: "flasques", txt: d.flasques === 1 ? t("flasque1", { ml: FLASQUE_ML }) : t("flasques", { n: d.flasques, ml: FLASQUE_ML }), montrer: d.flasques > 0 },
    { k: "sel", txt: t("sel", { mg: d.sodiumTotalMg.toLocaleString(lang) }), montrer: d.sodiumTotalMg > 0 },
  ].filter((x) => x.montrer) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><Utensils className="h-[18px] w-[18px]" /></span>
          <div>
            <h3 className="text-base font-bold text-zinc-900">{t("titre")}</h3>
            <p className="mt-0.5 text-sm text-zinc-500">{t("sous")}</p>
          </div>
        </div>

        {/* Ta course */}
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold text-zinc-600">{t("course")}</div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
            {courses.map((c, i) => (
              <button key={`${c.nom}|${c.date}`} type="button" onClick={() => setChoix(i)} className={`${puce(choix === i)} h-auto py-1.5`} aria-pressed={choix === i}>
                <span className="flex flex-col items-start leading-tight">
                  <span className="max-w-[14rem] truncate">{c.nom}</span>
                  <span className={`text-[11px] ${choix === i ? "text-zinc-300" : "text-zinc-400"}`}>
                    {formatDateCivile(c.date, lang, { day: "numeric", month: "short" })} · {c.dureeSec != null ? `≈ ${duree(c.dureeSec / 60)} ${c.origine === "cible" ? t("visee") : t("predite")}` : t("sansDuree")}
                  </span>
                </span>
              </button>
            ))}
            <button type="button" onClick={() => setChoix(-1)} className={puce(choix === -1 || (course != null && course.dureeSec == null))} aria-pressed={choix === -1}>
              <Clock className="h-4 w-4 opacity-70" />{t("autre")}
            </button>
          </div>
          {(choix === -1 || course?.dureeSec == null) && (
            <label htmlFor={`${id}-d`} className="mt-3 flex items-center gap-3">
              <span className="text-sm text-zinc-500">{t("duree")}</span>
              <select id={`${id}-d`} value={dureeLibre} onChange={(e) => setDureeLibre(Number(e.target.value))}
                className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                {DUREES.map((m) => <option key={m} value={m}>{duree(m)}</option>)}
              </select>
            </label>
          )}
        </div>

        {/* Météo */}
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-semibold text-zinc-600">{t("meteo")}</div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
            <button type="button" onClick={() => setTranche(null)} className={puce(tranche == null)} aria-pressed={tranche == null}>{t("nsp")}</button>
            {TRANCHES_TEMPERATURE.map((x) => (
              <button key={x.cle} type="button" onClick={() => setTranche(x.cle)} className={puce(tranche === x.cle)} aria-pressed={tranche === x.cle}>{libelleTranche(x)}</button>
            ))}
          </div>
        </div>
      </div>

      {!plan || !d ? (
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />{t("court", { d: duree(DUREE_MIN_MIN) })}
        </div>
      ) : (
        <>
          {/* Par heure */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="text-[13px] font-semibold text-zinc-600">{t("parHeure")}</div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-zinc-100">
              {[
                { icone: Flame, v: plan.glucidesParH, u: "g", l: t("glucides"), c: "text-amber-600" },
                { icone: Droplets, v: plan.mlParH, u: "ml", l: t("boisson"), c: "text-sky-600" },
                { icone: Utensils, v: d.sodiumMgParH, u: "mg", l: t("sodium"), c: "text-zinc-500" },
              ].map((x) => (
                <div key={x.l} className="px-2 text-center first:pl-0 last:pr-0">
                  <x.icone className={`mx-auto h-4 w-4 ${x.c}`} aria-hidden />
                  <div className="mt-1.5 text-2xl font-bold tabular-nums text-zinc-900">{x.v.toLocaleString(lang)}<span className="ml-0.5 text-sm font-semibold text-zinc-400">{x.u}</span></div>
                  <div className="text-xs text-zinc-500">{x.l}</div>
                </div>
              ))}
            </div>
            {!plan.tempConnue && <p className="mt-4 text-xs text-zinc-500">{t("tempInconnue")}</p>}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Dans ton sac — cochable, comme une liste de courses */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="text-[13px] font-semibold text-zinc-600">{t("sac")}</div>
              <ul className="mt-3 space-y-2">
                {sac.map((x) => (
                  <li key={x.k}>
                    <button type="button" onClick={() => setCoches((c) => ({ ...c, [x.k]: !c[x.k] }))} aria-pressed={!!coches[x.k]}
                      className="flex w-full items-center gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50">
                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${coches[x.k] ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 bg-white"}`}>
                        {coches[x.k] && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className={coches[x.k] ? "text-zinc-400 line-through" : "text-zinc-800"}>{x.txt}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Le déroulé */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="text-[13px] font-semibold text-zinc-600">{t("deroule")}</div>
              <ol className="mt-3 space-y-4 text-sm">
                <li>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("avant")}</div>
                  <p className="mt-1 text-zinc-700">{plan.avantCourseG != null ? t("avantPoids", { g: plan.avantCourseG }) : t("avantSans")}</p>
                </li>
                <li>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("pendant")}</div>
                  <p className="mt-1 text-zinc-700">{t("boire")}</p>
                  <ul className="mt-2 space-y-1">
                    {d.prises.slice(0, PRISES_VISIBLES).map((m) => (
                      <li key={m} className="flex items-center gap-3">
                        <span className="w-14 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-500">{duree(m)}</span>
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" aria-hidden />
                        <span className="text-zinc-800">{t("prise", { ml: d.mlParPrise })}</span>
                      </li>
                    ))}
                  </ul>
                  {d.prises.length > PRISES_VISIBLES && <p className="mt-1 pl-[4.25rem] text-xs text-zinc-500">{t("puis", { n: d.intervalleMin })}</p>}
                </li>
                <li>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("apres")}</div>
                  <p className="mt-1 text-zinc-700">{t("apresTxt")}</p>
                </li>
              </ol>
            </div>
          </div>
          <p className="px-1 text-[11px] text-zinc-400">{t("source")}</p>
        </>
      )}
    </div>
  );
}

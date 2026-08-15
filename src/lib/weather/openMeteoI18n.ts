// ─────────────────────────────────────────────────────────────────────────────
//  CONSIGNES MÉTÉO — les 5 langues.
//
//  Ces notes ne vivent pas à part : `autoPlan` les COLLE à la fin du `detail` de
//  chaque séance. Les laisser en français revenait donc à livrer une séance à moitié
//  traduite — un texte allemand qui se termine par « Électrolytes obligatoires
//  au-delà de 45 min. ».
//
//  ⚠️ Le français reste la version CANONIQUE : c'est elle qui part sur la montre et
//  qui sert aux analyses. Les autres langues ne sont produites que pour l'affichage.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesMeteo = {
  /** ≥ 30 °C */ chaleurExtreme: (t: string, humide: boolean) => string;
  /** ≥ 25 °C */ chaleurForte: (t: string, humide: boolean) => string;
  /** ≥ 20 °C */ chaleurLegere: (t: string) => string;
  /** 5–20 °C */ ideal: (t: string) => string;
  /** 0–5 °C */ frais: (t: string) => string;
  /** < 0 °C */ froid: (t: string) => string;
  ventFort: (v: string) => string;
  ventModere: (v: string) => string;
  ventLeger: (v: string) => string;
};

export const METEO_T: Record<Lang, TextesMeteo> = {
  fr: {
    chaleurExtreme: (t, h) => `🥵 ${t} °C${h ? " et humide" : ""} : renonce au fractionné, déplace la séance tôt le matin ou tard le soir. Compte ${h ? "1 min" : "45 s"}/km de plus à effort égal — juge à la FC, jamais au chrono. Électrolytes obligatoires au-delà de 45 min.`,
    chaleurForte: (t, h) => `🌡️ ${t} °C${h ? " et humide" : ""} : compte ~${h ? 40 : 25} s/km de plus à effort égal. Ne cherche pas tes allures habituelles, tu te grillerais pour rien.`,
    chaleurLegere: (t) => `${t} °C : légère dégradation, compte ~10 s/km. Hydrate-toi avant de partir.`,
    ideal: (t) => `${t} °C : conditions idéales, c'est le moment des séances chronométrées.`,
    frais: (t) => `🧥 ${t} °C : échauffement rallongé et couvert.`,
    froid: (t) => `🥶 ${t} °C : échauffement de 20 min minimum, pas de fractionné court à froid (risque musculaire). Attention aux voies respiratoires par temps sec et glacial.`,
    ventFort: (v) => `💨 Vent de ${v} km/h : renonce à toute séance chronométrée, tu ne tiendras aucune allure de référence. Si tu sors, fais l'aller face au vent et le retour dans le dos, et juge-toi à la FC. En terrain découvert, prudence sur les rafales.`,
    ventModere: (v) => `💨 Vent de ${v} km/h : compte ~18 s/km de plus face au vent. Une séance de qualité devient très difficile à piloter à l'allure — bascule sur la FC, ou déplace-la.`,
    ventLeger: (v) => `💨 Vent de ${v} km/h : ~10 s/km de plus dans les portions face au vent. Le retour dans le dos ne compense pas l'aller, n'en attends rien.`,
  },
  en: {
    chaleurExtreme: (t, h) => `🥵 ${t} °C${h ? " and humid" : ""}: skip the intervals, move the session to early morning or late evening. Expect ${h ? "1 min" : "45 s"}/km slower for the same effort — judge by heart rate, never by the clock. Electrolytes are mandatory beyond 45 min.`,
    chaleurForte: (t, h) => `🌡️ ${t} °C${h ? " and humid" : ""}: expect ~${h ? 40 : 25} s/km slower for the same effort. Do not chase your usual paces, you would burn yourself for nothing.`,
    chaleurLegere: (t) => `${t} °C: slight degradation, expect ~10 s/km. Hydrate before you head out.`,
    ideal: (t) => `${t} °C: ideal conditions, this is the moment for timed sessions.`,
    frais: (t) => `🧥 ${t} °C: longer warm-up and stay covered.`,
    froid: (t) => `🥶 ${t} °C: 20 min of warm-up minimum, no short intervals from cold (muscle risk). Watch your airways in dry, freezing weather.`,
    ventFort: (v) => `💨 Wind at ${v} km/h: drop any timed session, you will not hold a single reference pace. If you do head out, run into the wind on the way out and with it on the way back, and judge yourself by heart rate. In open terrain, beware of gusts.`,
    ventModere: (v) => `💨 Wind at ${v} km/h: expect ~18 s/km slower into the wind. A quality session becomes very hard to steer by pace — switch to heart rate, or move it.`,
    ventLeger: (v) => `💨 Wind at ${v} km/h: ~10 s/km slower on the sections into the wind. The tailwind on the way back does not make up for the way out, expect nothing from it.`,
  },
  de: {
    chaleurExtreme: (t, h) => `🥵 ${t} °C${h ? " und feucht" : ""}: Verzichte auf Intervalle, verlege die Einheit auf den frühen Morgen oder späten Abend. Rechne mit ${h ? "1 min" : "45 s"}/km mehr bei gleicher Belastung — beurteile nach Herzfrequenz, nie nach der Uhr. Elektrolyte ab 45 min Pflicht.`,
    chaleurForte: (t, h) => `🌡️ ${t} °C${h ? " und feucht" : ""}: Rechne mit ~${h ? 40 : 25} s/km mehr bei gleicher Belastung. Jage nicht deinen gewohnten Tempos hinterher, du verheizt dich umsonst.`,
    chaleurLegere: (t) => `${t} °C: leichte Einbuße, rechne mit ~10 s/km. Trinke vor dem Loslaufen.`,
    ideal: (t) => `${t} °C: ideale Bedingungen, jetzt ist die Zeit für Einheiten auf Zeit.`,
    frais: (t) => `🧥 ${t} °C: längeres Aufwärmen und gut eingepackt.`,
    froid: (t) => `🥶 ${t} °C: mindestens 20 min Aufwärmen, keine kurzen Intervalle aus der Kälte heraus (Muskelrisiko). Achte bei trockener Eiseskälte auf die Atemwege.`,
    ventFort: (v) => `💨 Wind mit ${v} km/h: Verzichte auf jede Einheit auf Zeit, du hältst kein einziges Referenztempo. Wenn du rausgehst, laufe hin gegen den Wind und zurück mit dem Wind, und beurteile dich nach der Herzfrequenz. Im offenen Gelände Vorsicht bei Böen.`,
    ventModere: (v) => `💨 Wind mit ${v} km/h: Rechne mit ~18 s/km mehr gegen den Wind. Eine Qualitätseinheit lässt sich kaum noch über das Tempo steuern — wechsle auf die Herzfrequenz oder verschiebe sie.`,
    ventLeger: (v) => `💨 Wind mit ${v} km/h: ~10 s/km mehr auf den Abschnitten gegen den Wind. Der Rückenwind zurück gleicht den Hinweg nicht aus, erwarte davon nichts.`,
  },
  es: {
    chaleurExtreme: (t, h) => `🥵 ${t} °C${h ? " y húmedo" : ""}: renuncia a las series, mueve la sesión a primera hora de la mañana o a última de la tarde. Cuenta ${h ? "1 min" : "45 s"}/km más a igual esfuerzo — júzgate por la FC, nunca por el crono. Electrolitos obligatorios más allá de 45 min.`,
    chaleurForte: (t, h) => `🌡️ ${t} °C${h ? " y húmedo" : ""}: cuenta ~${h ? 40 : 25} s/km más a igual esfuerzo. No persigas tus ritmos habituales, te quemarías para nada.`,
    chaleurLegere: (t) => `${t} °C: ligera degradación, cuenta ~10 s/km. Hidrátate antes de salir.`,
    ideal: (t) => `${t} °C: condiciones ideales, es el momento de las sesiones cronometradas.`,
    frais: (t) => `🧥 ${t} °C: calentamiento más largo y bien abrigado.`,
    froid: (t) => `🥶 ${t} °C: 20 min de calentamiento como mínimo, nada de series cortas en frío (riesgo muscular). Cuidado con las vías respiratorias con tiempo seco y helado.`,
    ventFort: (v) => `💨 Viento de ${v} km/h: renuncia a cualquier sesión cronometrada, no mantendrás ningún ritmo de referencia. Si sales, haz la ida de cara al viento y la vuelta a favor, y júzgate por la FC. En terreno abierto, prudencia con las rachas.`,
    ventModere: (v) => `💨 Viento de ${v} km/h: cuenta ~18 s/km más de cara al viento. Una sesión de calidad se vuelve muy difícil de pilotar por ritmo — pásate a la FC, o muévela.`,
    ventLeger: (v) => `💨 Viento de ${v} km/h: ~10 s/km más en los tramos de cara al viento. La vuelta a favor no compensa la ida, no esperes nada de ella.`,
  },
  pt: {
    chaleurExtreme: (t, h) => `🥵 ${t} °C${h ? " e húmido" : ""}: desiste das séries, passa a sessão para o início da manhã ou o fim da tarde. Conta ${h ? "1 min" : "45 s"}/km a mais para o mesmo esforço — avalia pela FC, nunca pelo cronómetro. Eletrólitos obrigatórios para além de 45 min.`,
    chaleurForte: (t, h) => `🌡️ ${t} °C${h ? " e húmido" : ""}: conta ~${h ? 40 : 25} s/km a mais para o mesmo esforço. Não persigas os teus ritmos habituais, ias queimar-te para nada.`,
    chaleurLegere: (t) => `${t} °C: ligeira degradação, conta ~10 s/km. Hidrata-te antes de sair.`,
    ideal: (t) => `${t} °C: condições ideais, é o momento das sessões cronometradas.`,
    frais: (t) => `🧥 ${t} °C: aquecimento mais longo e bem agasalhado.`,
    froid: (t) => `🥶 ${t} °C: 20 min de aquecimento no mínimo, nada de séries curtas a frio (risco muscular). Atenção às vias respiratórias com tempo seco e gelado.`,
    ventFort: (v) => `💨 Vento de ${v} km/h: desiste de qualquer sessão cronometrada, não vais aguentar nenhum ritmo de referência. Se saíres, faz a ida contra o vento e a volta a favor, e avalia-te pela FC. Em terreno aberto, cuidado com as rajadas.`,
    ventModere: (v) => `💨 Vento de ${v} km/h: conta ~18 s/km a mais contra o vento. Uma sessão de qualidade fica muito difícil de gerir pelo ritmo — passa para a FC, ou muda-a de dia.`,
    ventLeger: (v) => `💨 Vento de ${v} km/h: ~10 s/km a mais nos troços contra o vento. A volta a favor não compensa a ida, não esperes nada dela.`,
  },
};

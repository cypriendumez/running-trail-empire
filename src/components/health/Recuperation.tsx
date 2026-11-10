"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";
import { BilanMatin } from "@/components/health/BilanMatin";
import type { DonneesRecup, ResumeIndicateur } from "@/lib/health/recuperation";

/**
 * SANTÉ › RÉCUPÉRATION (lot 2, 10/11/2026).
 *
 * Le bilan du matin, son historique, et les indicateurs de récupération que l'application
 * calcule déjà : forme et VFC viennent des MÊMES fiches que les pages Indicateurs
 * (lib/indicateurs/fiches, calculées côté serveur) — l'onglet ne peut pas les contredire.
 * Une donnée absente est dite absente, jamais remplacée par un chiffre plausible.
 * Ce sont des indicateurs d'ENTRAÎNEMENT : ils règlent la charge, ils ne disent rien de la santé.
 */
const T: Record<Lang, {
  indicateurs: string; avertissement: string; forme: string; vfc: string; sommeil: string; fcRepos: string; detail: string;
  derniereNuit: string; moyenne: string; aucuneNuit: string; aucuneFc: string; fcReposAide: string;
  fatigueDurable: string; historique: string; aucunBilan: string; date: string; fatigue: string; jambes: string; stress: string; panne: string; vide: string;
}> = {
  fr: {
    fatigueDurable: "Trois matins de suite avec une fatigue ou des jambes à 4 ou 5 sur 5 : chaque jour, ta séance dure est remplacée par une sortie facile. Si cela dure malgré le repos, parles-en à un médecin.",
    indicateurs: "Tes indicateurs de récupération", avertissement: "Ce sont des indicateurs d'entraînement, pas un examen de santé : ils règlent ta charge. Une fatigue qui dure plusieurs semaines malgré le repos se montre à un médecin.",
    forme: "Fraîcheur", vfc: "Variabilité cardiaque (VFC)", sommeil: "Sommeil", fcRepos: "FC de repos de référence", detail: "Voir le détail",
    derniereNuit: "Dernière nuit synchronisée ({d})", moyenne: "Moyenne des nuits mesurées sur 7 jours ({n})",
    aucuneNuit: "Aucune nuit synchronisée : ta montre n'envoie pas encore ton sommeil.", aucuneFc: "Non mesurée : aucun test ni relevé enregistré.",
    fcReposAide: "Celle de ton dernier test ou relevé, utilisée pour tes zones.",
    historique: "Tes bilans des 14 derniers jours", aucunBilan: "Aucun bilan pour l'instant.", date: "Date", fatigue: "Fatigue", jambes: "Jambes", stress: "Stress",
    panne: "Une partie de tes données n'a pas pu être lue : ces indicateurs sont incomplets.", vide: "Pas assez de données.",
  },
  en: {
    fatigueDurable: "Three mornings in a row with fatigue or legs at 4 or 5 out of 5: each day, your hard session is replaced by an easy run. If it lasts despite rest, talk to a doctor.",
    indicateurs: "Your recovery indicators", avertissement: "These are training indicators, not a health check: they set your load. Fatigue that lasts several weeks despite rest should be seen by a doctor.",
    forme: "Freshness", vfc: "Heart rate variability (HRV)", sommeil: "Sleep", fcRepos: "Reference resting HR", detail: "See details",
    derniereNuit: "Last synced night ({d})", moyenne: "Average of measured nights over 7 days ({n})",
    aucuneNuit: "No night synced: your watch does not send your sleep yet.", aucuneFc: "Not measured: no test or reading recorded.",
    fcReposAide: "From your latest test or reading, used for your zones.",
    historique: "Your check-ins over the last 14 days", aucunBilan: "No check-in yet.", date: "Date", fatigue: "Fatigue", jambes: "Legs", stress: "Stress",
    panne: "Part of your data could not be read: these indicators are incomplete.", vide: "Not enough data.",
  },
  de: {
    fatigueDurable: "Drei Morgen hintereinander mit Müdigkeit oder Beinen bei 4 oder 5 von 5: Jeden Tag wird deine harte Einheit durch einen lockeren Lauf ersetzt. Hält es trotz Ruhe an, sprich mit einer Ärztin oder einem Arzt.",
    indicateurs: "Deine Erholungswerte", avertissement: "Das sind Trainingswerte, keine Gesundheitsuntersuchung: Sie steuern deine Belastung. Müdigkeit, die trotz Ruhe mehrere Wochen anhält, gehört zum Arzt.",
    forme: "Frische", vfc: "Herzfrequenzvariabilität (HRV)", sommeil: "Schlaf", fcRepos: "Referenz-Ruhepuls", detail: "Details ansehen",
    derniereNuit: "Letzte synchronisierte Nacht ({d})", moyenne: "Durchschnitt der gemessenen Nächte über 7 Tage ({n})",
    aucuneNuit: "Keine Nacht synchronisiert: Deine Uhr sendet deinen Schlaf noch nicht.", aucuneFc: "Nicht gemessen: kein Test und kein Messwert gespeichert.",
    fcReposAide: "Aus deinem letzten Test oder Messwert, für deine Zonen verwendet.",
    historique: "Deine Checks der letzten 14 Tage", aucunBilan: "Noch kein Check.", date: "Datum", fatigue: "Müdigkeit", jambes: "Beine", stress: "Stress",
    panne: "Ein Teil deiner Daten konnte nicht gelesen werden: Diese Werte sind unvollständig.", vide: "Nicht genug Daten.",
  },
  es: {
    fatigueDurable: "Tres mañanas seguidas con cansancio o piernas en 4 o 5 sobre 5: cada día, tu sesión dura se sustituye por una salida suave. Si dura pese al descanso, coméntalo con un médico.",
    indicateurs: "Tus indicadores de recuperación", avertissement: "Son indicadores de entrenamiento, no un examen de salud: regulan tu carga. Un cansancio que dura varias semanas pese al descanso se consulta con un médico.",
    forme: "Frescura", vfc: "Variabilidad cardiaca (VFC)", sommeil: "Sueño", fcRepos: "FC en reposo de referencia", detail: "Ver el detalle",
    derniereNuit: "Última noche sincronizada ({d})", moyenne: "Media de las noches medidas en 7 días ({n})",
    aucuneNuit: "Ninguna noche sincronizada: tu reloj aún no envía tu sueño.", aucuneFc: "No medida: ningún test ni registro guardado.",
    fcReposAide: "La de tu último test o registro, usada para tus zonas.",
    historique: "Tus chequeos de los últimos 14 días", aucunBilan: "Ningún chequeo por ahora.", date: "Fecha", fatigue: "Cansancio", jambes: "Piernas", stress: "Estrés",
    panne: "Una parte de tus datos no se ha podido leer: estos indicadores están incompletos.", vide: "No hay suficientes datos.",
  },
  pt: {
    fatigueDurable: "Três manhãs seguidas com cansaço ou pernas a 4 ou 5 em 5: cada dia, a tua sessão dura é substituída por uma corrida fácil. Se durar apesar do descanso, fala com um médico.",
    indicateurs: "Os teus indicadores de recuperação", avertissement: "São indicadores de treino, não um exame de saúde: regulam a tua carga. Um cansaço que dura várias semanas apesar do descanso deve ser visto por um médico.",
    forme: "Frescura", vfc: "Variabilidade cardíaca (VFC)", sommeil: "Sono", fcRepos: "FC em repouso de referência", detail: "Ver o detalhe",
    derniereNuit: "Última noite sincronizada ({d})", moyenne: "Média das noites medidas em 7 dias ({n})",
    aucuneNuit: "Nenhuma noite sincronizada: o teu relógio ainda não envia o teu sono.", aucuneFc: "Não medida: nenhum teste ou registo guardado.",
    fcReposAide: "A do teu último teste ou registo, usada para as tuas zonas.",
    historique: "Os teus check-ins dos últimos 14 dias", aucunBilan: "Nenhum check-in por agora.", date: "Data", fatigue: "Cansaço", jambes: "Pernas", stress: "Stress",
    panne: "Uma parte dos teus dados não pôde ser lida: estes indicadores estão incompletos.", vide: "Dados insuficientes.",
  },
};

const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
const LOC: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };
const jjmm = (lang: Lang, iso: string) => new Intl.DateTimeFormat(LOC[lang], { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const duree = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`;
const TON: Record<string, string> = { excellent: "text-emerald-700", bon: "text-emerald-700", moyen: "text-amber-700", alerte: "text-red-700", neutre: "text-zinc-600" };

function Carte({ titre, ind, href, t }: { titre: string; ind: ResumeIndicateur | null; href: string; t: (typeof T)["fr"] }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
      <p className="text-[13px] font-medium text-zinc-500">{titre}</p>
      {!ind || ind.vide ? (
        <p className="mt-1 text-[13px] text-zinc-600">{ind?.vide ?? t.vide}</p>
      ) : (
        <>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{ind.valeur}{ind.unite ? <span className="ml-1 text-sm font-normal text-zinc-500">{ind.unite}</span> : null}
            {ind.statut && <span className={`ml-2 text-[13px] font-medium ${TON[ind.statut.ton] ?? TON.neutre}`}>{ind.statut.libelle}</span>}</p>
          <p className="mt-1 text-[12.5px] leading-snug text-zinc-600">{ind.verdict}</p>
        </>
      )}
      <Link href={href} className="mt-2 inline-block text-[12.5px] font-medium text-emerald-700 hover:underline">{t.detail} →</Link>
    </div>
  );
}

export function Recuperation({ d }: { d: DonneesRecup }) {
  const { lang } = useT();
  const l = (lang as Lang) in T ? (lang as Lang) : "fr";
  const t = T[l];
  return (
    <div className="space-y-4">
      <BilanMatin initial={d.bilanJour} variante="onglet" />
      {d.fatigueDurable && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t.fatigueDurable}</p>}

      <section className="space-y-2.5">
        <h2 className="text-[15px] font-semibold text-zinc-900">{t.indicateurs}</h2>
        {d.panne && <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-800">{t.panne}</p>}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Carte titre={t.forme} ind={d.forme} href="/dashboard/indicateurs/forme" t={t} />
          <Carte titre={t.vfc} ind={d.vfc} href="/dashboard/indicateurs/vfc" t={t} />
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
            <p className="text-[13px] font-medium text-zinc-500">{t.sommeil}</p>
            {d.sommeil.derniere ? (
              <>
                <p className="mt-1 text-[13px] text-zinc-600">{fill(t.derniereNuit, { d: jjmm(l, d.sommeil.derniere.date) })}</p>
                <p className="text-xl font-semibold text-zinc-900">
                  {d.sommeil.derniere.min != null ? duree(d.sommeil.derniere.min) : "—"}
                  {d.sommeil.derniere.score != null && <span className="ml-2 text-sm font-normal text-zinc-500">{d.sommeil.derniere.score}/100</span>}
                </p>
                {d.sommeil.moyenneMin != null && <p className="mt-1 text-[12.5px] text-zinc-600">{fill(t.moyenne, { n: d.sommeil.nuits })} : {duree(d.sommeil.moyenneMin)}</p>}
              </>
            ) : <p className="mt-1 text-[13px] text-zinc-600">{t.aucuneNuit}</p>}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
            <p className="text-[13px] font-medium text-zinc-500">{t.fcRepos}</p>
            {d.fcRepos != null ? (
              <>
                <p className="mt-1 text-xl font-semibold text-zinc-900">{d.fcRepos}<span className="ml-1 text-sm font-normal text-zinc-500">bpm</span></p>
                <p className="mt-1 text-[12.5px] text-zinc-600">{t.fcReposAide}</p>
              </>
            ) : <p className="mt-1 text-[13px] text-zinc-600">{t.aucuneFc}</p>}
          </div>
        </div>
        <p className="text-[12px] leading-snug text-zinc-500">{t.avertissement}</p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-[15px] font-semibold text-zinc-900">{t.historique}</h2>
        {d.bilans.length === 0 ? <p className="mt-1 text-[13px] text-zinc-600">{t.aucunBilan}</p> : (
          <table className="mt-2 w-full text-left text-[13px]">
            <thead><tr className="text-zinc-500"><th className="py-1 font-medium">{t.date}</th><th className="py-1 font-medium">{t.fatigue}</th><th className="py-1 font-medium">{t.jambes}</th><th className="py-1 font-medium">{t.stress}</th></tr></thead>
            <tbody>{d.bilans.map((b) => (
              <tr key={b.date} className="border-t border-zinc-100">
                <td className="py-1 text-zinc-700">{jjmm(l, b.date)}</td>
                {[b.fatigue, b.jambes, b.stress].map((n, i) => <td key={i} className={`py-1 font-medium ${n >= 4 ? "text-amber-700" : "text-zinc-800"}`}>{n}/5</td>)}
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}

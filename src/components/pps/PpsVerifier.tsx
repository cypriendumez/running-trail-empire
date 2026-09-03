"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  « MON PASS » — coller son numéro, savoir jusqu'à quand on peut courir.
//
//  ⚠️ CE QUE CETTE CASE NE FAIT PAS, ET NE PEUT PAS FAIRE.
//  Elle ne VALIDE pas le numéro auprès de la fédération : l'API de contrôle de la FFA
//  est réservée aux entreprises labellisées répondant à son cahier des charges. Les
//  organisateurs, eux, scannent le QR code du pass. Laisser croire à une vérification
//  serait un mensonge dangereux — l'athlète se présenterait au retrait des dossards en
//  confiance sur la foi d'une pastille verte qui ne vaut rien. Le texte le dit à chaque
//  affichage, pas en petits caractères.
//
//  Ce que nous savons et que la fédération ignore, ce sont SES COURSES. On répond donc à
//  la question qu'il se pose vraiment : jusqu'à quand, et lesquelles.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { CalendarCheck, Check, X, Loader2, Info } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PPS_T } from "@/lib/pps/ppsI18n";
import { couvertureCourses, ppsExpiration, type PpsStatus } from "@/lib/pps/status";
import { jourCivil } from "@/lib/time/fuseau";
import { useFuseau } from "@/lib/time/FuseauProvider";

const jourLisible = (iso: string, lang: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });

/** Contrôle de FORME seulement : un numéro plausible, pas un numéro vérifié. */
const formeValide = (n: string) => /^[A-Z0-9-]{6,24}$/.test(n.trim().toUpperCase());

export function PpsVerifier({
  initial, courses,
}: { initial: PpsStatus | null; courses: { date: string; nom: string }[] }) {
  const fuseau = useFuseau();
  const { lang } = useT();
  const t = PPS_T[lang] ?? PPS_T.fr;

  const [numero, setNumero] = useState(initial?.number ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? ppsExpiration(initial?.obtainedAt) ?? "");
  const [licensed, setLicensed] = useState(initial?.licensed === true);
  const [etat, setEtat] = useState<"repos" | "envoi" | "ok">("repos");

  // Le verdict se recalcule À LA SAISIE : l'athlète voit l'effet de sa date avant même
  // d'enregistrer. C'est ce qui transforme un formulaire en réponse.
  const res = useMemo(
    () => couvertureCourses({ expiresAt: expiresAt || null, obtainedAt: null, licensed }, courses),
    [expiresAt, licensed, courses],
  );

  const numeroDouteux = numero.trim().length > 0 && !formeValide(numero);
  // ⚠️ CE JOUR DÉCIDE D'UN VERDICT. Entre minuit et 2 h à Paris, le jour UTC est
  // celui de la veille : un pass expirant aujourd'hui aurait été déclaré encore
  // valable, ou l'inverse. On date sur le fuseau de l'athlète.
  const aujourdhui = jourCivil(new Date(), fuseau);

  const enregistrer = async () => {
    setEtat("envoi");
    await fetch("/api/pps", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt: expiresAt || null, number: numero || null, licensed }),
    }).catch(() => undefined);
    setEtat("ok");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white"><CalendarCheck className="h-4.5 w-4.5" /></span>
        <h2 className="text-[17px] font-bold tracking-tight text-zinc-900">{t.verifTitre}</h2>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-3.5 transition-colors hover:bg-zinc-50">
        <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)}
               className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
        <span>
          <span className="block text-sm font-semibold text-zinc-900">{t.licencieCase}</span>
          <span className="block text-[12.5px] text-zinc-500">{t.licencieAide}</span>
        </span>
      </label>

      {!licensed && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pps-n" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-zinc-500">{t.champNumero}</label>
            <input id="pps-n" value={numero} onChange={(e) => setNumero(e.target.value)}
                   placeholder="PA00A000AA0" spellCheck={false} autoComplete="off"
                   className={`w-full rounded-xl border px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider outline-none focus:ring-2 ${numeroDouteux ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"}`} />
            <p className={`mt-1 text-[11.5px] ${numeroDouteux ? "text-amber-600" : "text-zinc-400"}`}>
              {numeroDouteux ? t.numeroFormat : t.champNumeroAide}
            </p>
          </div>
          <div>
            <label htmlFor="pps-e" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-zinc-500">{t.champDate}</label>
            <input id="pps-e" type="date" value={expiresAt} min={aujourdhui}
                   onChange={(e) => setExpiresAt(e.target.value)}
                   className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            <p className="mt-1 text-[11.5px] text-zinc-400">{t.champDateAide}</p>
          </div>
        </div>
      )}

      {/* ── LA RÉPONSE ─────────────────────────────────────────────────────── */}
      <div className="mt-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
        <p className="text-[15px] font-bold leading-snug text-zinc-900">
          {licensed ? t.jusquALicencie
            : res.derniereDate ? t.jusquA(jourLisible(res.derniereDate, lang))
            : t.jusquAInconnu}
        </p>

        {(licensed || res.derniereDate) && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{t.mesCourses}</p>
            {res.courses.length === 0 ? (
              <p className="mt-2 text-[13px] text-zinc-500">{t.aucuneCourse}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {res.courses.slice(0, 6).map((c, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${c.couverte ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {c.couverte ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-zinc-800">{c.nom}</span>
                    <span className="flex-shrink-0 text-zinc-400">{jourLisible(c.date, lang)}</span>
                    <span className={`flex-shrink-0 text-[11.5px] font-semibold ${c.couverte ? "text-emerald-600" : "text-rose-600"}`}>
                      {c.couverte ? t.couverte : t.nonCouverte}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Le rappel est DANS la réponse, pas en note de bas de page : c'est lui qui
            empêche l'athlète de prendre une pastille verte pour une validation. */}
        <p className="mt-4 flex gap-2 text-[11.5px] leading-relaxed text-zinc-500">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{t.pasDeVerification}
        </p>
      </div>

      <button onClick={enregistrer} disabled={etat === "envoi"} className="btn-brand mt-5 disabled:opacity-60">
        {etat === "envoi" ? <Loader2 className="h-4 w-4 animate-spin" /> : etat === "ok" ? <Check className="h-4 w-4" /> : null}
        {etat === "ok" ? t.enregistre : t.enregistrer}
      </button>
    </div>
  );
}

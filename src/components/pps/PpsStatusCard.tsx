"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  L'ÉTAT DU PPS, AFFICHÉ LÀ OÙ IL SERT.
//
//  Le même composant sert au bandeau de la page Courses et à la page dédiée : un
//  athlète ne doit pas lire deux verdicts différents selon l'écran par lequel il est
//  passé — c'est exactement le défaut qu'on vient de corriger sur la VMA.
//
//  `raceDate` est le paramètre qui rend l'information utile : « valable » tout court ne
//  dit rien à quelqu'un qui court dans sept mois. Avec la date, on répond à la vraie
//  question — « est-ce que ça tiendra jusqu'au jour J ? ».
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink, Loader2, Check } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PPS_T } from "@/lib/pps/ppsI18n";
import { PPS_URL, PPS_PRIX_EUR, PPS_VALIDITE_MOIS, ppsVerdict, type PpsStatus, type PpsVerdict } from "@/lib/pps/status";

/** Palette par verdict : le vert ne doit jamais servir à annoncer une échéance ratée. */
const TON: Record<PpsVerdict["kind"], { bg: string; ring: string; fg: string; icon: typeof ShieldCheck }> = {
  valide:             { bg: "bg-emerald-50",  ring: "ring-emerald-200/70", fg: "text-emerald-700", icon: ShieldCheck },
  licencie:           { bg: "bg-emerald-50",  ring: "ring-emerald-200/70", fg: "text-emerald-700", icon: ShieldCheck },
  inconnu:            { bg: "bg-amber-50",    ring: "ring-amber-200/70",   fg: "text-amber-700",   icon: ShieldQuestion },
  expire:             { bg: "bg-rose-50",     ring: "ring-rose-200/70",    fg: "text-rose-700",    icon: ShieldAlert },
  expireAvantCourse:  { bg: "bg-rose-50",     ring: "ring-rose-200/70",    fg: "text-rose-700",    icon: ShieldAlert },
};

export function usePpsTextes() {
  const { lang } = useT();
  return { t: PPS_T[lang] ?? PPS_T.fr, lang };
}

/** Date lisible dans la langue de l'athlète (« 4 mars 2027 »). */
const jourLisible = (iso: string, lang: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });

export function PpsStatusCard({
  status, raceDate = null, compact = false, showCta = true,
}: { status: PpsStatus | null; raceDate?: string | null; compact?: boolean; showCta?: boolean }) {
  const { t, lang } = usePpsTextes();
  const v = useMemo(() => ppsVerdict(status, raceDate), [status, raceDate]);
  const ton = TON[v.kind];
  const Icon = ton.icon;

  const titre =
    v.kind === "licencie" ? t.vLicencie
    : v.kind === "inconnu" ? t.vInconnu
    : v.kind === "valide" ? t.vValide(jourLisible(v.expiresAt, lang), v.joursRestants)
    : v.kind === "expire" ? t.vExpire(jourLisible(v.expiresAt, lang))
    : t.vExpireAvantCourse(jourLisible(v.expiresAt, lang), jourLisible(v.raceDate, lang));

  const doitAgir = v.kind === "inconnu" || v.kind === "expire" || v.kind === "expireAvantCourse";

  return (
    <div className={`rounded-2xl ${ton.bg} ring-1 ${ton.ring} ${compact ? "p-3.5" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex ${compact ? "h-8 w-8" : "h-10 w-10"} flex-shrink-0 items-center justify-center rounded-xl bg-white/70 ${ton.fg}`}>
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${ton.fg} ${compact ? "text-[13px]" : "text-[15px]"} leading-snug`}>{titre}</p>
          {v.kind === "inconnu" && <p className="mt-0.5 text-[13px] text-zinc-600">{t.vInconnuAide}</p>}
          {/* Le rappel accompagne TOUT verdict chiffré : nous ne vérifions rien auprès
              de la fédération, et l'athlète doit le savoir avant de s'y fier. */}
          {v.kind !== "licencie" && v.kind !== "inconnu" && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">{t.avertissement}</p>
          )}
          {showCta && doitAgir && (
            <a href={PPS_URL} target="_blank" rel="noopener noreferrer"
               className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800">
              {t.cta} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {/* Le tarif et la durée sont annoncés par le bandeau de la page PPS : les répéter
            sur la carte d'état ferait lire deux fois la même chose au même écran. */}
      </div>
    </div>
  );
}

/**
 * Le formulaire de suivi. Volontairement minimal : une date, un numéro facultatif,
 * une case « licencié ». Demander plus serait demander ce dont on n'a pas l'usage.
 */
export function PpsTracker({ initial }: { initial: PpsStatus | null }) {
  const { t } = usePpsTextes();
  const [obtainedAt, setObtainedAt] = useState(initial?.obtainedAt ?? "");
  const [numero, setNumero] = useState(initial?.number ?? "");
  const [licensed, setLicensed] = useState(initial?.licensed === true);
  const [etat, setEtat] = useState<"repos" | "envoi" | "ok">("repos");

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const enregistrer = async () => {
    setEtat("envoi");
    await fetch("/api/pps", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obtainedAt: obtainedAt || null, number: numero || null, licensed }),
    }).catch(() => undefined);
    setEtat("ok");
    // On rafraîchit pour que le verdict affiché plus haut reparte de la valeur ENREGISTRÉE
    // et non de l'état local : deux sources d'affichage finiraient par se contredire.
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-3.5 transition-colors hover:bg-zinc-50">
        <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)}
               className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
        <span>
          <span className="block text-sm font-semibold text-zinc-900">{t.licencieCase}</span>
          <span className="block text-[12.5px] text-zinc-500">{t.licencieAide}</span>
        </span>
      </label>

      {!licensed && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pps-date" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-zinc-500">{t.champDate}</label>
            <input id="pps-date" type="date" value={obtainedAt} max={aujourdhui}
                   onChange={(e) => setObtainedAt(e.target.value)}
                   className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <div>
            <label htmlFor="pps-num" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-zinc-500">{t.champNumero}</label>
            <input id="pps-num" type="text" value={numero} onChange={(e) => setNumero(e.target.value)}
                   placeholder="—"
                   className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            <p className="mt-1 text-[11.5px] text-zinc-400">{t.champNumeroAide}</p>
          </div>
        </div>
      )}

      <button onClick={enregistrer} disabled={etat === "envoi"} className="btn-brand disabled:opacity-60">
        {etat === "envoi" ? <Loader2 className="h-4 w-4 animate-spin" /> : etat === "ok" ? <Check className="h-4 w-4" /> : null}
        {etat === "ok" ? t.enregistre : t.enregistrer}
      </button>
    </div>
  );
}

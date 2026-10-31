"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, Check, Pencil, Search, MapPin, Flag } from "lucide-react";
import { btnClass } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { AvertissementAge as Avertissement } from "@/lib/coach/ageDistance";
import { formatDateCivile } from "@/lib/time/fuseau";
import { useFuseau } from "@/lib/time/FuseauProvider";
import { jourLocal } from "@/lib/streak/compute";
import { avancementObjectif } from "@/lib/dashboard/fenetre";
import { estOfficielle } from "@/lib/coach/prochaineCourse";

export type Objective = {
  race: string; distanceKm: number; raceDate: string; heureDepart?: string | null;
  targetSeconds: number; targetTime: string; targetPace: string;
  /** `false` : défi personnel, pas une course officielle. Absent = course officielle. */
  officielle?: boolean;
  /** Début de la préparation de CET objectif (AAAA-MM-JJ), et date d'enregistrement (ISO) :
   *  l'anneau « préparation » part de là (`avancementObjectif`). */
  depuis?: string | null;
  ts?: string | null;
};

type RaceSug = { name: string; city: string; distanceKm: number | null; date: string; type: string };

const PRESETS: { label: string; km: number }[] = [
  { label: "1\u00a0000 m", km: 1 }, { label: "1\u00a0500 m", km: 1.5 }, { label: "3\u00a0000 m", km: 3 },
  { label: "5 km", km: 5 }, { label: "10 km", km: 10 },
  { label: "Semi", km: 21.1 }, { label: "Marathon", km: 42.2 }, { label: "Trail 25K", km: 25 },
];

// ⚠️ LA CHARTE (DESIGN.md), PLUS L'INDIGO. Cette carte était la seule de l'application en
// violet — boutons, pastilles, focus — et Cyprien la trouvait « trop IA » (30/10/2026). Champs
// à liseré fin et focus émeraude, bouton principal noir, émeraude par petites touches.
const champCls = "w-full rounded-xl bg-white px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 outline-none transition-shadow placeholder:text-zinc-400 focus:ring-2 focus:ring-[#059669]";
const libelleCls = "mb-1.5 block text-[13px] font-medium text-zinc-700";
// Le chrono se saisit en chiffres de course (Anton) : c'est le seul élément appuyé de la carte.
const chiffreCls = "bg-transparent p-0 text-center font-sport text-[2.5rem] leading-none text-[#11201d] outline-none placeholder:text-zinc-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// Distance fiable d'une course : déduite du NOM (plus fiable que le catalogue, parfois
// erroné — ex. « Marathon de Lille » tagué 10 km). Une distance explicite dans le nom prime.
function inferDistance(name: string, dbKm: number | null): number | null {
  const n = (name || "").toLowerCase();
  const km = n.match(/(\d{1,3}(?:[.,]\d)?)\s?k(?:m)?\b/);       // "10 km", "25k", "42.2km", "100k"
  if (km) return parseFloat(km[1].replace(",", "."));
  const m = n.match(/\b(800|1000|1500|3000|5000|10000)\s?m\b/); // distances piste (mètres)
  if (m) return Number(m[1]) / 1000;
  if (/semi|half|½/.test(n)) return 21.1;                       // semi-marathon
  if (/marathon/.test(n)) return 42.2;                          // marathon
  return dbKm;                                                  // sinon : distance du catalogue
}

export function ObjectiveCard({ objective, derniereCourse = null, currentVma, aujourdhui }: { objective: Objective | null; derniereCourse?: { race: string; raceDate: string } | null; currentVma?: number | null;
  /** Jour civil de l'athlète, fourni par le serveur : « J-50 » doit être le même au rendu et à l'hydratation. */
  aujourdhui?: string }) {
  const router = useRouter();
  const { t, lang } = useT();
  const fuseau = useFuseau();
  // ⚠️ UN OBJECTIF N'EST PAS TOUJOURS UNE COURSE (Cyprien, 30/10/2026 : « vers la mi-décembre
  // je vais tenter le sub 16 min, mais ce n'est pas une course officielle »). Le formulaire
  // exigeait une course du catalogue : un test chrono ne pouvait pas s'enregistrer. Un défi
  // personnel garde distance, chrono et date ; il perd ce qui n'existe que pour une épreuve
  // (catalogue, heure de départ de l'organisateur, PPS, classement).
  const [officielle, setOfficielle] = useState(estOfficielle(objective));
  const [editing, setEditing] = useState(!objective);
  const [race, setRace] = useState(objective?.race ?? "");
  const [distance, setDistance] = useState(objective ? String(objective.distanceKm) : "");
  const s0 = objective?.targetSeconds ?? 0;
  const [th, setTh] = useState(s0 >= 3600 ? String(Math.floor(s0 / 3600)) : "");
  const [tm, setTm] = useState(s0 ? String(Math.floor((s0 % 3600) / 60)) : "");
  const [ts, setTs] = useState(s0 % 60 ? String(s0 % 60) : "");
  const [date, setDate] = useState(objective?.raceDate ?? "");
  // ⚠️ SAISIE PAR L'ATHLÈTE, JAMAIS IMPORTÉE. Les deux agrégateurs qui alimentent le
  //    catalogue ne publient pas l'heure de départ — vérifié à la source : la fiche du
  //    Marathon de Lille donne `startDate: 2026-10-25`, sans heure. Elle est pourtant
  //    dans le mail d'inscription de l'athlète. Facultative : un champ vide vaut mieux
  //    qu'une heure devinée, qu'on planifierait et sur laquelle on raterait son départ.
  const [heure, setHeure] = useState(objective?.heureDepart ?? "");
  const [saving, setSaving] = useState(false);
  /** Avertissements liés à l'âge, renvoyés par l'API au moment de l'enregistrement.
   *  Affichés SOUS l'objectif, et refermables : c'est une information, pas une punition. */
  const [avertissements, setAvertissements] = useState<Avertissement[]>([]);
  /** Verdict de réalisme au moment de l'enregistrement : `true` = rien à signaler (on le
   *  DIT, en vert), `false` = les avertissements sont dans la liste ci-dessus, `null` =
   *  le serveur n'a pas pu se prononcer (on ne dit rien plutôt que « tout va bien »). */
  const [verdictOk, setVerdictOk] = useState<boolean | null>(null);

  // Autocomplétion des courses (catalogue) → sélection auto-remplit distance + date.
  const [sug, setSug] = useState<RaceSug[]>([]);
  const [openSug, setOpenSug] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRace = (v: string) => {
    setRace(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length < 2) { setSug([]); setOpenSug(false); return; }
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/races/search?q=${encodeURIComponent(v.trim())}`);
        const j = await r.json();
        setSug(j.races ?? []); setOpenSug((j.races ?? []).length > 0);
      } catch { /* ignore */ }
    }, 250);
  };
  const pickRace = (s: RaceSug) => {
    setRace(s.name);
    const km = inferDistance(s.name, s.distanceKm);
    if (km) setDistance(String(km));
    // Ignore les dates « placeholder » (2099 = date inconnue) → l'utilisateur la renseigne.
    if (s.date && new Date(s.date + "T00:00:00").getFullYear() < 2099) setDate(s.date);
    else setDate("");
    setOpenSug(false); setSug([]);
  };

  const targetSeconds = (Number(th) || 0) * 3600 + (Number(tm) || 0) * 60 + (Number(ts) || 0);
  // L'allure que ce chrono impose, recalculée à chaque frappe : c'est elle qui dit à un
  // coureur ce que vaut son objectif (16 min sur 5 km, c'est 3'12 au kilomètre).
  const allure = (() => {
    const km = Number(distance);
    if (!(targetSeconds > 0) || !(km > 0)) return null;
    const sec = Math.round(targetSeconds / km);
    return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;
  })();

  const save = async () => {
    if (officielle && !race.trim()) return toast.error(t("obj.errRace"));
    if (!(Number(distance) > 0)) return toast.error(t("obj.errDistance"));
    // Un défi personnel peut rester sans nom : il en reçoit un, lisible partout où l'objectif
    // s'affiche (tableau de bord, calendrier, titre des séances sur la montre).
    const nom = race.trim() || t("obj.unofficialDefault", { km: Number(distance).toLocaleString(lang) });
    if (targetSeconds <= 0) return toast.error(t("obj.errTime"));
    if (!date) return toast.error(t("obj.errDate"));
    // Une date déjà passée ferait un objectif périmé dès l'enregistrement, que le coach
    // ignorerait aussitôt. Jour de l'ATHLÈTE, lu au clic (jamais pendant le rendu).
    if (date < jourLocal(new Date(), fuseau)) return toast.error(t("obj.errPast"));
    setSaving(true);
    try {
      const r = await fetch("/api/objective", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: nom, distanceKm: Number(distance), targetTime: `${Number(th) || 0}:${Number(tm) || 0}:${Number(ts) || 0}`, raceDate: date, startTime: officielle ? heure || undefined : undefined, officielle }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(t("obj.ok"));
        // ── AVERTISSEMENT D'ÂGE ────────────────────────────────────────────────
        // L'objectif est ENREGISTRÉ quoi qu'il arrive : c'est le sien, on ne décide
        // pas à sa place. Mais un athlète de 18 ans qui vise un marathon ne pourra
        // pas s'inscrire à une épreuve officielle en France, et l'apprendre après
        // douze semaines de préparation serait cruel. On le lui dit maintenant,
        // pendant qu'il peut encore choisir une autre course.
        // Plusieurs autorités peuvent parler en même temps : à 16 ans, un marathon
        // se heurte à la règle fédérale ET à l'avis médical. On les affiche toutes.
        // ── RÉALISME, AU MÊME INSTANT (Cyprien, 21/09/2026) ───────────────────
        // Chrono hors de portée, sortie longue impossible d'ici la course : dits ICI,
        // pas trois jours plus tard dans le calendrier. Fusionnés avec l'âge dans la
        // même liste refermable ; et quand il n'y a rien à signaler, on le dit aussi.
        const age = Array.isArray(j.avertissementsAge) ? (j.avertissementsAge as Avertissement[]) : [];
        const realisme = (Array.isArray(j.avertissementsRealisme) ? (j.avertissementsRealisme as string[]) : [])
          .map((texte): Avertissement => ({ niveau: "progression", categorie: "", texte, sources: [] }));
        setAvertissements([...age, ...realisme]);
        setVerdictOk(typeof j.verdictOk === "boolean" ? j.verdictOk : null);
        setEditing(false);
        router.refresh();
      }
      else toast.error(j.error || t("obj.fail"));
    } catch { toast.error(t("obj.saveFail")); }
    finally { setSaving(false); }
  };

  // En jours CIVILS : l'heure exacte et le fuseau de la machine donnaient « J-51 » au serveur
  // (UTC) et « J-50 » au téléphone entre minuit et 1 h — erreur React #418.
  const daysTo = avancementObjectif(objective, aujourdhui ?? jourLocal(new Date(), fuseau))?.joursRestants ?? null;

  // ── Vue lecture — une ligne : l'objectif, son échéance, son chrono ──
  if (objective && !editing) {
    return (
      <div className="mb-5 rounded-2xl bg-white px-4 py-3.5 ring-1 ring-zinc-200 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[15px] font-semibold tracking-tight text-zinc-900">{objective.race}</span>
              {!estOfficielle(objective) && <Badge className="px-2 py-0.5">{t("obj.unofficialBadge")}</Badge>}
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-zinc-500">
              <span className="tabular-nums">{objective.distanceKm.toLocaleString(lang)} km</span>
              <span>{formatDateCivile(objective.raceDate, lang, { day: "numeric", month: "long", year: "numeric" })}</span>
              {daysTo != null && daysTo >= 0 && <span className="font-semibold tabular-nums text-[#059669]">J-{daysTo}</span>}
              {/* Le pack jour J (Premium) : visible pour tous, la page dit ce qu'il contient à qui ne l'a pas. */}
              <Link href="/dashboard/jour-j" className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline-offset-2 hover:underline">
                <Flag className="h-3 w-3" /> {t("obj.packJourJ")}
              </Link>
            </p>
          </div>
          {/* Le chrono, en chiffres de course : c'est lui qu'on vient relire. */}
          <div className="text-right">
            <div className="font-sport text-[1.75rem] leading-none text-[#11201d]">{objective.targetTime}</div>
            <div className="mt-1 text-[12px] tabular-nums text-zinc-500">{objective.targetPace}</div>
          </div>
          <button onClick={() => setEditing(true)} className={btnClass("secondary", "sm")}>
            <Pencil className="h-3.5 w-3.5" /> {t("obj.edit")}
          </button>
        </div>
        {/* Avertissement d'âge. Ambre pour un conseil de progression, rouge quand la
            distance n'est pas autorisée par le règlement fédéral — la nuance compte :
            l'un se discute, l'autre empêche de s'inscrire. */}
        {verdictOk === true && avertissements.length === 0 && (
          <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
            <p className="flex-1">{t("obj.verdictOk")}</p>
            <button onClick={() => setVerdictOk(null)} className="text-[11px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100">
              {t("obj.warnClose")}
            </button>
          </div>
        )}
        {avertissements.map((a, i) => (
          <div key={i} className={`mt-2.5 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
            a.niveau === "reglement" ? "border-red-200 bg-red-50 text-red-900"
              : a.niveau === "medical" ? "border-orange-200 bg-orange-50 text-orange-900"
              : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <p>{a.texte}</p>
            {/* La SOURCE est affichée. Un avertissement de santé qu'on ne peut pas
                vérifier ne se discute pas — et finit par ne plus se croire. */}
            {a.sources?.length > 0 && (
              <p className="mt-1 text-[11px] italic opacity-75">Source : {a.sources.join(" · ")}</p>
            )}
            {i === avertissements.length - 1 && (
              <button onClick={() => setAvertissements([])}
                className="mt-1.5 text-[11px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100">
                {t("obj.warnClose")}
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Vue édition / création ──
  const titre = objective ? t("obj.editTitle") : derniereCourse ? t("obj.nextTitle") : t("obj.createTitle");
  // Chaque case prend la largeur de ce qu'elle affiche : à largeur fixe, « 3 » h laissait un
  // trou avant les deux-points (« 3 :30:00 »), là où une horloge de course écrit 3:30:00.
  const caseChrono = (valeur: string, maj: (v: string) => void, unite: string, aria: string, max: number) => {
    const exemple = unite === "h" ? "0" : "00";
    return (
      <input type="number" min="0" max={max} inputMode="numeric" value={valeur} onChange={(e) => maj(e.target.value)}
        placeholder={exemple} aria-label={aria} className={chiffreCls}
        style={{ width: `${Math.max(1, (valeur || exemple).length) + 0.15}ch` }} />
    );
  };
  const deuxPoints = <span aria-hidden className="px-0.5 font-sport text-[2.5rem] leading-none text-zinc-300">:</span>;
  const unite = (u: string) => <span aria-hidden className="justify-self-center text-[11px] text-zinc-400">{u}</span>;

  return (
    <section aria-label={titre} className="mb-5 rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
      <header>
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">{titre}</h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">{t("obj.sub")}</p>
        {/* La course passée est NOMMÉE, plus reproposée : le formulaire s'ouvre vide. */}
        {!objective && derniereCourse && (
          <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-zinc-600">
            <Flag aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#059669]" />
            {t("obj.pastRace", { race: derniereCourse.race, date: formatDateCivile(derniereCourse.raceDate, lang, { day: "numeric", month: "long" }) })}
          </p>
        )}
      </header>

      <div className="mt-5 space-y-5">
        {/* Course officielle ou défi perso : un choix franc, en tête — la case à cocher
            placée sous le champ « Course » arrivait après qu'on avait cherché en vain. */}
        <div role="radiogroup" aria-label={t("obj.kind")} className="inline-flex rounded-xl bg-zinc-100 p-1">
          {([true, false] as const).map((choix) => (
            <button key={String(choix)} type="button" role="radio" aria-checked={officielle === choix}
              onClick={() => { setOfficielle(choix); setSug([]); setOpenSug(false); }}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] ${
                officielle === choix ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}>
              {choix ? t("obj.kindRace") : t("obj.kindChallenge")}
            </button>
          ))}
        </div>

        <label className="block">
          <span className={libelleCls}>{officielle ? t("obj.race") : t("obj.unofficialName")}</span>
          {officielle ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={race} onChange={(e) => onRace(e.target.value)} onFocus={() => sug.length && setOpenSug(true)}
              onBlur={() => setTimeout(() => setOpenSug(false), 150)}
              placeholder={t("obj.racePh")} className={champCls + " pl-9"} autoComplete="off" />
            {openSug && (
              <div className="absolute z-20 mt-1.5 max-h-60 w-full overflow-auto rounded-xl bg-white py-1 shadow-[0_18px_40px_-22px_rgba(16,24,40,.35)] ring-1 ring-zinc-200">
                {sug.map((s, i) => (
                  <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); pickRace(s); }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">{s.name}</span>
                      <span className="flex items-center gap-1 truncate text-[12px] text-zinc-500">
                        {s.city && <><MapPin className="h-3 w-3" />{s.city} · </>}{formatDateCivile(s.date, lang, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                    {(() => { const dk = inferDistance(s.name, s.distanceKm); return dk != null ? <span className="flex-shrink-0 text-[12px] font-medium tabular-nums text-zinc-500">{dk} km</span> : null; })()}
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : (
            <input value={race} onChange={(e) => setRace(e.target.value)} placeholder={t("obj.unofficialPh")}
              maxLength={80} className={champCls} autoComplete="off" />
          )}
        </label>

        <div>
          <span className={libelleCls}>{t("obj.distance")}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => {
              const actif = Number(distance) === p.km;
              return (
                <button key={p.label} type="button" aria-pressed={actif} onClick={() => setDistance(String(p.km))}
                  className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] ${
                    actif ? "bg-zinc-900 text-white" : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"}`}>
                  {p.km === 21.1 ? t("obj.presetHalf") : p.km === 25 ? t("obj.presetTrail25") : p.label}
                </button>
              );
            })}
            <div className="relative ml-auto w-[96px]">
              <input type="number" inputMode="decimal" step="0.1" min="0" value={distance} onChange={(e) => setDistance(e.target.value)}
                placeholder="42.2" aria-label={t("obj.distance")} className={champCls + " pr-9 text-right tabular-nums"} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-400">km</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className={libelleCls}>{t("obj.target")}</span>
            <div className="rounded-2xl bg-zinc-50 px-4 pb-3 pt-3.5 ring-1 ring-inset ring-zinc-200 transition-shadow focus-within:bg-white focus-within:ring-2 focus-within:ring-[#059669]">
              {/* Chiffres et deux-points sur une même ligne, centrés entre eux comme sur une
                  horloge de course ; les unités dessous, sur leur propre ligne. */}
              <div className="grid w-max grid-cols-[auto_auto_auto_auto_auto] items-center gap-y-1">
                {caseChrono(th, setTh, "h", t("obj.hours"), 99)}
                {deuxPoints}
                {caseChrono(tm, setTm, "min", t("obj.minutes"), 59)}
                {deuxPoints}
                {caseChrono(ts, setTs, "s", t("obj.seconds"), 59)}
                {unite("h")}<span />{unite("min")}<span />{unite("s")}
              </div>
              <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-[13px] font-medium tabular-nums text-[#059669]">
                {allure ? t("obj.paceLive", { pace: allure }) : ""}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className={libelleCls}>{officielle ? t("obj.date") : t("obj.dateTarget")}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champCls} />
            </label>
            {/* L'heure de départ est celle d'un ORGANISATEUR : un défi personnel n'en a pas. */}
            {officielle && (
            <label className="block">
              <span className={libelleCls}>{t("obj.startTime")}</span>
              <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champCls} />
              <span className="mt-1.5 block text-[12px] leading-snug text-zinc-500">{t("obj.startTimeHint")}</span>
            </label>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving} className={btnClass("primary", "md")}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("obj.save")}
          </button>
          {objective && (
            <button onClick={() => setEditing(false)} className={btnClass("ghost", "md")}>{t("obj.cancel")}</button>
          )}
        </div>
      </div>
    </section>
  );
}

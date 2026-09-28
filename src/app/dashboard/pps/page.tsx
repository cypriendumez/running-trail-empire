// ─────────────────────────────────────────────────────────────────────────────
//  PAGE PPS — tout ce qu'il faut savoir, et l'endroit où l'on suit son échéance.
//
//  Elle sert de point d'ancrage : le bandeau de la page Courses et le panneau
//  d'inscription y renvoient. On ne répète pas l'explication à trois endroits, on la
//  met UNE fois, bien, et on la référence.
//
//  La prochaine course de l'athlète est chargée ici : c'est elle qui transforme
//  « valable jusqu'au 4 mars » en « valable le jour de ta course », seule formulation
//  qui aide réellement quelqu'un à décider.
// ─────────────────────────────────────────────────────────────────────────────
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PpsStatusCard } from "@/components/pps/PpsStatusCard";
import { PpsVerifier } from "@/components/pps/PpsVerifier";
import { PPS_T } from "@/lib/pps/ppsI18n";
import { PPS_URL, PPS_PRIX_EUR, PPS_VALIDITE_MOIS, type PpsStatus } from "@/lib/pps/status";
import { normLang } from "@/lib/i18n/translations";
import { ShieldCheck, ExternalLink, Award, Baby, ArrowRight } from "lucide-react";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pass Prévention Santé" };

export default async function PpsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const today = aujourdhui(FUSEAU_DEFAUT);
  const [{ data: ppsRow }, { data: profileRow }, { data: objRow }, { data: plannedRows }] = await Promise.all([
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "pps_status").maybeSingle(),
    sb.from("profiles").select("preferred_language").eq("id", user.id).single(),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(50),
  ]);

  const status = (ppsRow?.data ?? null) as PpsStatus | null;
  const lang = normLang(profileRow?.preferred_language ?? "fr");
  const t = PPS_T[lang] ?? PPS_T.fr;

  // LA PROCHAINE ÉCHÉANCE, objectif ou course simplement notée : c'est contre ELLE que
  // le pass doit tenir. Sans cette date, le verdict n'est qu'un compte à rebours.
  const obj = (objRow?.data ?? {}) as { race?: string; raceDate?: string };
  // Les courses de l'athlète, objectif compris : c'est contre ELLES que le pass doit tenir.
  const coursesAVenir = [
    ...(obj.raceDate ? [{ date: String(obj.raceDate).slice(0, 10), nom: obj.race || "Objectif" }] : []),
    ...(plannedRows ?? []).map((r) => {
      const d = (r.data ?? {}) as { date?: string; name?: string };
      return { date: String(d.date ?? "").slice(0, 10), nom: d.name || "Course" };
    }),
  ].filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date >= today)
   .filter((c, i, a) => a.findIndex((x) => x.date === c.date && x.nom === c.nom) === i)
   .sort((a, b) => a.date.localeCompare(b.date));

  const dates = [
    String(((objRow?.data ?? {}) as { raceDate?: string }).raceDate ?? "").slice(0, 10),
    ...(plannedRows ?? []).map((r) => String(((r.data ?? {}) as { date?: string }).date ?? "").slice(0, 10)),
  ].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).sort();
  const prochaineCourse = dates[0] ?? null;

  // ⚠️ REFAIT LE 29/09/2026 (Cyprien : « aménage la page, tu perds trop de place, on
  // défile trop, surtout sur téléphone »). Le grand bandeau noir et la carte d'état
  // portaient LE MÊME bouton l'un sous l'autre, et le premier écran du téléphone ne
  // montrait rien d'autre. Désormais : un en-tête d'une ligne, l'état personnel (c'est ce
  // qu'on vient chercher) avec le SEUL appel à agir, puis le reste en blocs serrés.
  return (
    <div className="mx-auto max-w-4xl sm:px-4 sm:py-6">
      {/* ── En-tête compact ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-emerald-400"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 sm:text-2xl">{t.titre}</h1>
          <p className="text-[13px] leading-snug text-zinc-500">
            <span className="font-semibold text-emerald-700">{t.prixEtDuree(PPS_PRIX_EUR, PPS_VALIDITE_MOIS)}</span> · {t.sousTitre}
          </p>
        </div>
      </div>

      {/* ── L'état personnel et le seul appel à agir ─────────────────────────── */}
      <section className="mt-4">
        <PpsStatusCard status={status} raceDate={prochaineCourse} />
        {/* Qui a déjà son pass va directement à la saisie, sans défiler toute la page. */}
        <a href="#mon-pps" className="mt-2 inline-flex items-center gap-1 px-1 text-[13px] font-semibold text-emerald-700 hover:text-emerald-800">
          {t.verifTitre} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </section>

      {/* ── Les 4 étapes : une carte, quatre lignes ──────────────────────────── */}
      <section className="mt-5 rounded-2xl border border-zinc-200/70 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-zinc-400">{t.etapesTitre}</h2>
          <a href={PPS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900">
            pps.athle.fr <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <ol className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {t.etapes.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-black text-white">{i + 1}</span>
              <span className="text-[13.5px] leading-snug text-zinc-700">{e}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Mon pass : coller son numéro, savoir jusqu'à quand ───────────────── */}
      <section id="mon-pps" className="mt-5 scroll-mt-4">
        <PpsVerifier initial={status} courses={coursesAVenir} />
      </section>

      {/* ── Ce que c'est / qui est concerné — à lire une fois, en bas ────────── */}
      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-zinc-400">{t.quoiTitre}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-700">{t.quoi}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-zinc-400">{t.quiTitre}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-700">{t.qui}</p>
          <div className="mt-3 space-y-2">
            <p className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-600">
              <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />{t.licencie}
            </p>
            <p className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-600">
              <Baby className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />{t.mineur}
            </p>
          </div>
        </div>
      </section>

      <a href="/dashboard/races" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 transition-colors hover:text-zinc-900">
        {PPS_T[lang]?.nav ?? PPS_T.fr.nav} → {t.avantInscription} <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

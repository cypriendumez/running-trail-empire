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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px] bg-zinc-900 p-7 text-white sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-300 ring-1 ring-white/15">
            <ShieldCheck className="h-3.5 w-3.5" /> {t.prixEtDuree(PPS_PRIX_EUR, PPS_VALIDITE_MOIS)}
          </span>
          <h1 className="mt-4 text-[30px] font-black leading-[1.1] tracking-tight sm:text-[40px]">{t.titre}</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">{t.sousTitre}</p>
          <a href={PPS_URL} target="_blank" rel="noopener noreferrer"
             className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.02] active:scale-95">
            {t.cta} <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* ── L'état personnel, tout de suite : c'est ce qu'on vient chercher ──── */}
      <section className="mt-6">
        <PpsStatusCard status={status} raceDate={prochaineCourse} />
      </section>

      {/* ── Les 4 étapes ─────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-zinc-400">{t.etapesTitre}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {t.etapes.map((e, i) => (
            <li key={i} className="flex gap-3.5 rounded-2xl border border-zinc-200/70 bg-white p-4">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-[12px] font-black text-white">{i + 1}</span>
              <span className="text-[14px] leading-relaxed text-zinc-700">{e}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Ce que c'est / qui est concerné ──────────────────────────────────── */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="bento-card">
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-zinc-400">{t.quoiTitre}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-700">{t.quoi}</p>
        </div>
        <div className="bento-card">
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-zinc-400">{t.quiTitre}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-700">{t.qui}</p>
          <div className="mt-4 space-y-2.5">
            <p className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-600">
              <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />{t.licencie}
            </p>
            <p className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-600">
              <Baby className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />{t.mineur}
            </p>
          </div>
        </div>
      </section>

      {/* ── Mon pass : coller son numéro, savoir jusqu'à quand ───────────────── */}
      <section className="mt-8">
        <PpsVerifier initial={status} courses={coursesAVenir} />
      </section>

      <a href="/dashboard/races" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 transition-colors hover:text-zinc-900">
        {PPS_T[lang]?.nav ?? PPS_T.fr.nav} → {t.avantInscription} <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

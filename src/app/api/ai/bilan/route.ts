export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";
import { exigeAcces } from "@/lib/billing/guard";
import { generateContent, budget } from "@/lib/ai/gemini";
import { lignesDuBilan, inviteBilan, empreinteBilan } from "@/lib/ai/bilanSemaine";
import { faitsDeLaSemaine, TYPE_BILAN } from "@/lib/ai/bilanDonnees";
import { chiffresInconnus } from "@/lib/ai/relectureSemaine";
import { langueDuCompte } from "@/lib/i18n/serverLang";
import { aujourdhui, fuseauOuDefaut } from "@/lib/time/fuseau";

/**
 * LE BILAN DE LA SEMAINE (Premium) — voir `lib/ai/bilanSemaine`.
 *
 * ⚠️ À LA DEMANDE, ET MÉMORISÉ. Rien ne part au modèle tant que les faits de la semaine
 * n'ont pas changé : rouvrir le tableau de bord resservira le même bilan sans rien dépenser.
 * Le plafond quotidien n'est décompté QUE si le modèle est vraiment appelé.
 *
 * ⚠️ UN CHIFFRE INVENTÉ REJETTE LE BILAN ENTIER (`chiffresInconnus`), comme pour les
 * conseils du coach avancé : un chiffre faux ne se corrige pas, il se refuse.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 0. La formule (402 pour Starter) — ne consomme rien ─────────────────────
  const refus = await exigeAcces(supabase, user.id, "bilan");
  if (refus) return refus.reponse;

  const jour = aujourdhui(fuseauOuDefaut(decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? "")));
  const { lang, profilLu } = await langueDuCompte(supabase, user.id);

  // ── 1. Les faits, toutes données à l'athlète (RLS) — la MÊME lecture que l'e-mail du lundi.
  const faits = await faitsDeLaSemaine(supabase as unknown as Parameters<typeof faitsDeLaSemaine>[0], user.id, jour);
  // Sans les séances, il n'y a pas de bilan : on le dit plutôt que d'en écrire un vide.
  if (!faits) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  const lignes = lignesDuBilan(faits);
  const empreinte = empreinteBilan(lignes, lang);

  // ── 2. Déjà écrit pour ces faits ? ─────────────────────────────────────────
  const admin = createAdminClient();
  // La ligne la plus RÉCENTE, pas `maybeSingle` : un doublon d'avant ferait une erreur à
  // chaque lecture, et le bilan ne s'afficherait plus jamais (relecture du 08/11/2026).
  const { data: memos, error: eCache } = await admin.from("notifications").select("id, data").eq("user_id", user.id).eq("type", TYPE_BILAN).order("created_at", { ascending: false }).limit(1);
  const memo = memos?.[0] ?? null;
  // Cache illisible ≠ pas de cache (audit du 08/11/2026) : sinon le modèle est payé, puis une
  // seconde ligne est insérée et plus aucune lecture ne passe (`maybeSingle`).
  if (eCache) {
    await journaliserEchecUneFois(admin, { source: "ia-bilan", userId: user.id, url: "/api/ai/bilan", message: `Cache illisible, modèle non appelé : ${eCache.code ?? "?"} ${eCache.message}` });
    return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  }
  const prec = memo?.data as { empreinte?: string; texte?: string } | null;
  if (prec?.empreinte === empreinte && prec.texte) return NextResponse.json({ ok: true, texte: prec.texte, memorise: true });

  // ── 3. Le plafond du jour, décompté seulement maintenant ───────────────────
  const plafond = await exigeAcces(supabase, user.id, "ia");
  if (plafond) return plafond.reponse;

  // ── 4. Le modèle rédige ────────────────────────────────────────────────────
  const r = await generateContent(
    [{ role: "user", parts: [{ text: inviteBilan(lignes, lang) }] }],
    { ...budget(400, 650), temperature: 0.5 },
  );
  if (!r.ok || !r.text?.trim()) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
  const texte = r.text.trim();
  const inventes = chiffresInconnus(texte, lignes);
  if (inventes.length) {
    console.warn("[bilan] rejeté, chiffres absents des faits :", inventes.join(", "));
    return NextResponse.json({ ok: false, error: "bilan_non_fiable" }, { status: 502 });
  }

  // ── 5. Mémoriser — une écriture ratée se repaierait à chaque ouverture ─────
  // Profil illisible : la langue est un repli (navigateur). Ce bilan est servi, pas mémorisé — il
  // écraserait celui écrit dans la langue du compte, et le modèle serait repayé (13/11/2026).
  if (!profilLu) return NextResponse.json({ ok: true, texte, memorise: false });
  const donnees = { empreinte, texte, semaine: faits.debut, lang, at: new Date().toISOString() };
  const { error: eMemo } = memo?.id
    ? await admin.from("notifications").update({ data: donnees }).eq("id", memo.id)
    : await admin.from("notifications").insert({ user_id: user.id, type: TYPE_BILAN, title: "bilan", body: "", read: true, data: donnees });
  if (eMemo) await journaliserEchecUneFois(admin, { source: "ia-bilan", userId: user.id, url: "/api/ai/bilan", message: `Bilan non mémorisé, il sera repayé : ${eMemo.code ?? "?"} ${eMemo.message}` });

  return NextResponse.json({ ok: true, texte, memorise: false });
}

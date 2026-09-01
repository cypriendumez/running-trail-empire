export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateContent } from "@/lib/ai/gemini";
import { promptRecherche, promptExtraction, analyserReponse } from "@/lib/races/heureWeb";
import { jourLocal } from "@/lib/streak/compute";

/**
 * L'HEURE DE DÉPART, CHERCHÉE SEULE SUR LE WEB.
 *
 * ⚠️ POURQUOI ELLE NE PEUT PAS VENIR DU CATALOGUE. finishers.com publie
 * `startDate: 2026-10-25` — une date, sans heure — son API répond 401, et sa fiche ne
 * pointe même pas vers le site de l'organisateur. jogging-plus est passé derrière un
 * défi anti-robot. L'information existe pourtant : sur le site de l'organisateur et
 * dans la presse locale. Elle est simplement hors de portée d'un import de catalogue.
 *
 * On la fait donc chercher par le modèle AVEC RECHERCHE WEB — une course à la fois,
 * celle que l'athlète prépare, pas les 17 027 du catalogue. Le coût est dérisoire
 * (quelques requêtes par jour) et s'arrête dès que l'heure est trouvée.
 *
 * ⚠️ ON N'ÉCRASE JAMAIS UNE HEURE SAISIE PAR L'ATHLÈTE. S'il l'a recopiée de son mail
 * d'inscription, il en sait plus que n'importe quelle recherche.
 */
export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || req.headers.get("authorization") !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sb = createAdminClient();
  const aujourdhui = jourLocal();

  const { data: lignes, error } = await sb.from("notifications")
    .select("id,user_id,data").eq("type", "race_objective").order("id").limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Obj = { race?: string; raceDate?: string; distanceKm?: number; heureDepart?: string | null;
               heureSource?: string[] | null; heureCherchéeLe?: string | null };

  let cherchees = 0, trouvees = 0;
  const details: { race: string; verdict: string }[] = [];

  for (const l of lignes ?? []) {
    const o = (l.data ?? {}) as Obj;
    if (!o.race || !o.raceDate) continue;
    // Course passée : plus rien à chercher.
    if (o.raceDate < aujourdhui) continue;
    // Déjà connue — saisie par l'athlète ou trouvée précédemment.
    if (o.heureDepart) continue;
    // Une seule recherche par jour et par objectif : l'organisateur ne publie pas
    // deux fois dans la même journée, et on ne veut pas brûler le quota du modèle.
    if (o.heureCherchéeLe === aujourdhui) continue;

    cherchees++;
    const demande = { race: o.race, raceDate: o.raceDate, distanceKm: o.distanceKm ?? null };

    // ── ÉTAPE 1 : chercher LARGE, et laisser répondre en clair ──────────────────
    //  Ma première version cadrait sur « le site officiel » et exigeait un HH:MM sec.
    //  Résultat : INCONNU sur le marathon de Lille, alors que l'heure — 11h15 — était
    //  annoncée depuis le 27 août. Le règlement officiel disait « Horaire à venir » ;
    //  l'annonce était ailleurs. Contraindre la forme de la réponse tue même la
    //  recherche : demander du JSON donne zéro source consultée. Vérifié.
    const rech = await generateContent(
      [{ role: "user", parts: [{ text: promptRecherche(demande) }] }],
      { temperature: 0, maxOutputTokens: 2000 },
      { tools: [{ google_search: {} }] },
    );

    const majBase: Obj = { ...o, heureCherchéeLe: aujourdhui };
    if (!rech.ok) {
      details.push({ race: o.race, verdict: "modèle indisponible" });
    } else {
      // ── ÉTAPE 2 : extraire l'heure DU FORMAT DEMANDÉ ─────────────────────────
      //  Le texte trouvé contient presque toujours plusieurs départs (« le marathon à
      //  11h15, le semi à 8h30 ») : prendre la première heure venue serait faux une
      //  fois sur deux. Appel court, sans recherche ni raisonnement.
      const ext = await generateContent(
        [{ role: "user", parts: [{ text: promptExtraction(rech.text, demande) }] }],
        { temperature: 0, maxOutputTokens: 40, thinkingConfig: { thinkingBudget: 0 } },
      );
      const v = ext.ok ? analyserReponse(ext.text, rech.sources) : { retenue: false as const, motif: "inconnu" as const };
      details.push({ race: o.race, verdict: v.retenue ? v.heure : v.motif });
      if (v.retenue) {
        majBase.heureDepart = v.heure;
        majBase.heureSource = v.sources;
        trouvees++;
      }
    }
    await sb.from("notifications").update({ data: majBase as unknown as Record<string, unknown> }).eq("id", l.id);
  }

  return NextResponse.json({ ok: true, objectifs: (lignes ?? []).length, cherchees, trouvees, details });
}

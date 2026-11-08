export const dynamic = "force-dynamic";
import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { synchroniser, poursuivre } from "@/lib/intervals/syncAndCoach";
import { identifiantsDe } from "@/lib/intervals/identifiants";
import { estErreurTransitoire } from "@/lib/cron/transitoire";
import {
  RAISONS_IGNOREES, issueDe, lireLivraison, lotsATraiter, secretAttendu, secretValide, statutHttp, type Issue,
} from "@/lib/intervals/webhook";

export const runtime = "nodejs";
// La réponse part dès la synchro faite ; traces et replanification continuent après elle
// (`after`), dans cette limite.
export const maxDuration = 60;

const ROUTE = "/api/webhooks/intervals";

/** Au journal de /admin › Bugs. Jamais le secret ni la clé : la cause seule. */
async function journaliser(userId: string | null, message: string, meta: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({
      user_id: userId, source: "intervals-webhook", message: message.slice(0, 2000), url: ROUTE, meta,
    });
    if (error) console.error("[webhook/intervals] journal non écrit :", error.message);
  } catch (e) {
    console.error("[webhook/intervals] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Après la réponse quand Next le permet : en production, `after`, que Vercel tient en vie
 * jusqu'à `maxDuration`. Tout de suite sinon : hors d'une requête (banc d'essai), `after` lève.
 */
async function apresLaReponse(tache: () => Promise<void>): Promise<void> {
  try { after(tache); } catch { await tache(); }
}

type Bilan = { athlete: string; issue: Issue; fresh: number; refus: number; passagers: number };

/**
 * Simple présence, sans aucune donnée ni secret : si intervals.icu (ou quelqu'un) vérifie
 * l'adresse en l'ouvrant, elle répond au lieu d'un 405 qui ressemblerait à une panne.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "alertes intervals.icu" });
}

/**
 * POST /api/webhooks/intervals — les alertes de l'application « Pacevo » chez intervals.icu.
 * Le format, ses pièges et la règle de réponse sont dans `lib/intervals/webhook`.
 */
export async function POST(req: Request) {
  const attendu = secretAttendu();
  if (!attendu) {
    // Sans secret, rien ne s'authentifie. 503 et non 401 : intervals.icu renverra l'alerte,
    // le temps que la variable soit posée (elle ne vaut qu'au déploiement SUIVANT).
    console.error("[webhook/intervals] INTERVALS_WEBHOOK_SECRET absent : alerte refusée");
    return NextResponse.json({ error: "Non configuré" }, { status: 503 });
  }

  const livraison = lireLivraison(await req.json().catch(() => null));
  if (!livraison) return NextResponse.json({ error: "Format inattendu" }, { status: 400 });
  if (!secretValide(livraison.secret, attendu)) {
    // Seul symptôme d'un secret désaccordé entre intervals.icu et Vercel : sans cette ligne,
    // chaque alerte serait refusée sans que personne le sache. Le panneau regroupe sur le
    // message : une rafale fait monter un compteur, pas mille entrées.
    await journaliser(null, "Alerte intervals.icu refusée : son secret ne correspond pas à INTERVALS_WEBHOOK_SECRET",
      { alertes: livraison.alertes.length });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lots, ignorees } = lotsATraiter(livraison.alertes);
  const raisons = Object.fromEntries(Object.keys(ignorees).map((t) => [t, RAISONS_IGNOREES[t] ?? "type non traité"]));
  if (!lots.length) {
    return NextResponse.json({ ok: true, athletes: 0, ignorees, raisons, rejetees: livraison.rejetees });
  }

  const admin = createAdminClient();
  // Une seule lecture pour toute la livraison. Les identifiants enregistrés viennent
  // d'intervals.icu lui-même (OAuth, ou /athlete/0 pour une clé), mais une ancienne saisie à
  // la main peut porter une majuscule : on cherche les deux écritures.
  const variantes = [...new Set(lots.flatMap((l) => [l.athleteId, l.athleteId.toUpperCase()]))];
  const { data: profils, error, status } = await admin.from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key").in("intervals_athlete_id", variantes);
  if (error) {
    // Sans les profils, aucune alerte ne trouve son athlète : qu'intervals.icu la renvoie.
    if (estErreurTransitoire(error, status)) console.warn("[webhook/intervals] profils injoignables :", error.message);
    else await journaliser(null, `Alerte intervals.icu : profils illisibles (${error.code ?? "?"} ${error.message})`, {});
    return NextResponse.json({ error: "Base indisponible" }, { status: 503 });
  }

  const bilans: Bilan[] = [];
  const suites: { userId: string; athleteId: string; apiKey: string; fresh: number }[] = [];
  // Une à une : une livraison porte d'ordinaire un seul athlète, et l'API d'intervals.icu
  // limite le débit. Chaque synchro tient en quelques secondes (3 jours par défaut).
  for (const lot of lots) {
    const relies = (profils ?? [])
      .filter((p) => String(p.intervals_athlete_id ?? "").trim().toLowerCase() === lot.athleteId)
      .flatMap((p) => { const ids = identifiantsDe(p); return ids ? [{ userId: String(p.id), ...ids }] : []; });
    if (!relies.length) {
      // Compte déconnecté de Pacevo dont l'autorisation court encore chez intervals.icu :
      // rien à synchroniser, et le renvoyer n'y changerait rien.
      console.warn(`[webhook/intervals] athlète ${lot.athleteId} : aucun compte Pacevo relié`);
      bilans.push({ athlete: lot.athleteId, issue: "inconnu", fresh: 0, refus: 0, passagers: 0 });
      continue;
    }
    for (const r of relies) {
      const s = await synchroniser(admin, { ...r, days: lot.jours, canal: "webhook" });
      const issue = issueDe(s);
      bilans.push({ athlete: lot.athleteId, issue, fresh: s.fresh, refus: s.refus, passagers: s.passagers });
      if (issue === "refusé") {
        // Autorisation retirée, portée manquante, réponse illisible : réessayer n'y changera
        // rien, donc on acquitte — mais on le dit, sinon cet athlète ne serait plus à jour
        // sans que personne le sache.
        await journaliser(r.userId, `Synchro refusée à l'alerte d'intervals.icu : ${s.error}`,
          { status: s.status ?? null, types: lot.types });
      }
      // La synchro est passée, même avec des écritures refusées : la suite a lieu.
      if (!s.error) suites.push({ ...r, fresh: s.fresh });
    }
  }

  if (suites.length) {
    await apresLaReponse(async () => {
      for (const x of suites) {
        try {
          const r = await poursuivre(admin, x, x.fresh);
          console.log(`[webhook/intervals] suite ${x.athleteId} · ${r.tracks.imported} trace(s) · replanifié : ${r.replanned ? "oui" : `non (${r.skipped})`}`);
        } catch (e) {
          console.error(`[webhook/intervals] suite ${x.athleteId} en échec :`, e instanceof Error ? e.message : String(e));
        }
      }
    });
  }

  const statut = statutHttp(bilans.map((b) => b.issue));
  const total = (k: "fresh" | "refus" | "passagers") => bilans.reduce((a, b) => a + b[k], 0);
  console.log(`[webhook/intervals] ${lots.length} athlète(s) · ${[...new Set(lots.flatMap((l) => l.types))].join(", ")} · ${total("fresh")} séance(s) inédite(s) · ${total("refus")} refus · réponse ${statut}`);
  return NextResponse.json({
    ok: statut === 200, athletes: lots.length, fresh: total("fresh"), refus: total("refus"),
    passagers: total("passagers"), bilans, ignorees, raisons, rejetees: livraison.rejetees,
  }, { status: statut });
}

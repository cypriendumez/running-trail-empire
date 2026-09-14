export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import {
  appareilDe, empreinteVisiteur, espaceDe, estRobot, langueDe, normaliserChemin, paysDe, pseudonymeCompte, referentDe,
} from "@/lib/visites/empreinte";

/**
 * POST /api/visite — une page vue. Publique et sans authentification, comme /api/log-error,
 * et pour la même raison : le site se visite sans compte.
 *
 * Répond TOUJOURS 204, quoi qu'il arrive : la balise est envoyée par `sendBeacon`, personne
 * ne lit la réponse, et une erreur ici ne doit jamais remonter à la page.
 *
 * ⚠️ TROIS REFUS SILENCIEUX, tous voulus :
 *  · un robot déclaré n'est pas compté ;
 *  · l'ÉDITEUR n'est pas compté — ses propres allers-retours dans l'espace coach
 *    gonfleraient « comptes actifs » du seul compte qui n'est pas un client ;
 *  · sans sel secret, on ne compte pas : une empreinte sans sel se devine.
 *
 * ⚠️ COUPE-CIRCUIT GLOBAL, pas par adresse (compter par adresse obligerait à la stocker,
 * voir /api/log-error) : au-delà du seuil par minute, on cesse d'écrire. Le palier gratuit
 * de Supabase plafonne à 500 Mo ; une boucle de script ne doit pas pouvoir le remplir.
 */
const CORPS_MAX = 2 * 1024;
const PAR_MINUTE_MAX = 600;
// Une réponse ne se sert qu'une fois : on en fabrique une neuve à chaque appel.
const rien = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  try {
    const annonce = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(annonce) && annonce > CORPS_MAX) return rien();
    const brut = await req.text();
    if (brut.length > CORPS_MAX) return rien();
    const body = (JSON.parse(brut || "{}") ?? {}) as Record<string, unknown>;

    const ua = req.headers.get("user-agent");
    if (estRobot(ua)) return rien();
    const hote = req.headers.get("host") ?? "";
    if (/^(localhost|127\.0\.0\.1)/.test(hote)) return rien();

    const sel = process.env.VISITES_SEL || process.env.CRON_SECRET || "";
    const chemin = normaliserChemin(typeof body.chemin === "string" ? body.chemin : null);
    if (!chemin || !sel) return rien();

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user && estAdmin(user.email)) return rien();

    // L'adresse n'est lue que pour entrer dans l'empreinte ; elle n'est jamais écrite.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
    const jour = aujourdhui(FUSEAU_DEFAUT);
    const visiteur = empreinteVisiteur({ sel, jour, ip, ua: String(ua ?? "") });
    if (!visiteur) return rien();

    const admin = createAdminClient();
    const { count } = await admin.from("visites")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((count ?? 0) >= PAR_MINUTE_MAX) return rien();

    const { error } = await admin.from("visites").insert({
      jour,
      chemin,
      espace: espaceDe(chemin),
      visiteur,
      compte: user ? pseudonymeCompte({ sel, userId: user.id }) : null,
      connecte: !!user,
      appareil: appareilDe(ua),
      langue: langueDe(typeof body.langue === "string" ? body.langue : req.headers.get("accept-language")),
      pays: paysDe(req.headers.get("x-vercel-ip-country")),
      referent: referentDe(typeof body.referent === "string" ? body.referent : null, hote),
    });
    // Le refus est silencieux pour le visiteur, jamais pour nous : sans cette ligne, une
    // table absente ou une colonne renommée ferait disparaître toute la mesure sans bruit.
    if (error) console.error("[visite] non enregistrée :", error.message);
  } catch { /* une balise ne fait jamais tomber une page */ }
  return rien();
}

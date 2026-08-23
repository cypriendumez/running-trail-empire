export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

/**
 * TOUT CHEMIN D'API INCONNU RÉPOND 404 — POUR TOUTES LES MÉTHODES.
 *
 * ⚠️ SANS CETTE ROUTE, UN POST VERS UN CHEMIN INEXISTANT RECEVAIT 200 ET UNE PAGE HTML.
 * Constaté en production : `GET /api/zzz` répondait bien 404, mais `POST /api/zzz`
 * répondait 200 — le cadre servait la page « introuvable » sans en reprendre le code.
 *
 * Ce n'est pas cosmétique. Les intégrations qui écrivent chez nous parlent en POST :
 * Stripe, les webhooks de montre, les notifications de boutique. Un chemin mal
 * orthographié leur aurait renvoyé « 200 OK » — l'émetteur considère l'événement livré,
 * ne réessaie jamais, et personne n'apprend que rien n'est arrivé. Un paiement encaissé
 * sans abonnement activé se répare à la main, une fois qu'un client s'en plaint.
 *
 * Ça a d'ailleurs commencé par me tromper moi : sondant une route de maintenance avec
 * une faute de frappe, j'ai lu ce 200 et annoncé qu'elle était grande ouverte. Elle ne
 * l'était pas.
 *
 * Les routes réelles gardent la priorité : un segment fixe l'emporte toujours sur un
 * attrape-tout. Cette route ne répond que pour ce qui n'existe pas.
 */
async function introuvable(req: Request) {
  return NextResponse.json(
    { error: "Not Found", chemin: new URL(req.url).pathname, methode: req.method },
    { status: 404 },
  );
}

export const GET = introuvable;
export const POST = introuvable;
export const PUT = introuvable;
export const PATCH = introuvable;
export const DELETE = introuvable;
export const HEAD = introuvable;
export const OPTIONS = introuvable;

export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { idEditeur } from "@/lib/compta/enregistrer";
import { typeDepuisUrl, choisirFiche, typeCorrige } from "@/lib/races/leSportif";
import { trancheAVerifier } from "@/lib/races/liens";
import { jourFrance } from "@/lib/races/jourFrance";

export const TYPE_ETAT = "races_types";
const BASE = "https://www.le-sportif.com";
const RECHERCHE = `${BASE}/Calendar/CalendarSearch.aspx`;
const LOT = 25;
const PAUSE_MS = 1500;

/**
 * CORRECTION DU TYPE DE COURSE PAR UNE TROISIÈME SOURCE.
 *
 * ⚠️ LES DEUX SOURCES DU CATALOGUE SE TROMPENT, ET SE CONTREDISENT. Constaté sur
 * « Foulées de Bondues » : finishers.com la classe TRAIL, le-sportif.com la donne comme
 * COURSE SUR ROUTE — et c'est le-sportif qui a raison, sa fiche détaille les cinq
 * épreuves et leurs horaires. Le type n'est pas cosmétique : il pilote l'icône, la
 * couleur, et surtout le FILTRE « Tous types » avec lequel un athlète cherche.
 *
 * CE QU'ON S'AUTORISE. Leur `robots.txt` dit `Allow: /` et n'interdit que cinq chemins
 * d'administration ; `/Calendar/CalendarSearch.aspx` n'en fait pas partie et répond 200.
 * On fait UNE recherche ciblée par ville, 25 courses par passage, 1,5 s entre chacune.
 * Pas de balayage du site : on ne demande que ce qu'on est déjà censé connaître.
 *
 * ⚠️ ET ON N'ÉCRIT QUE SUR CORRESPONDANCE CERTAINE. Une fiche d'une autre année, un seul
 * mot en commun, deux candidates : on passe. Écrire le type d'une course sur une autre
 * remplacerait une erreur visible par une erreur invisible.
 */
export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || req.headers.get("authorization") !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const proprietaire = await idEditeur();
  if (!proprietaire) return NextResponse.json({ error: "Aucun compte d'administration." }, { status: 500 });

  const sb = createAdminClient();
  const aujourdhui = jourFrance();

  // Seules les courses À VENIR méritent une correction : le type d'une édition passée
  // n'intéresse plus personne, et le catalogue ne l'affiche pas.
  const { data: courses, error } = await sb.from("races")
    .select("id,name,city,date,distance_km,type")
    .gte("date", aujourdhui).lt("date", "2099-01-01")
    .not("city", "is", null).order("id").limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: ligne } = await sb.from("notifications").select("id,data")
    .eq("user_id", proprietaire).eq("type", TYPE_ETAT).maybeSingle();
  const etat = (ligne?.data ?? {}) as { curseur?: number; corrigees?: number; vues?: number };

  const ids = (courses ?? []).map((c) => String(c.id));
  const { tranche, suivant } = trancheAVerifier(ids, etat.curseur ?? 0, LOT);
  const parId = new Map((courses ?? []).map((c) => [String(c.id), c]));

  let corrigees = 0, vues = 0, appariees = 0;
  const details: { course: string; de: string; vers: string }[] = [];

  // Le formulaire ASP.NET exige un VIEWSTATE frais : on le reprend à chaque passage.
  const page = await fetch(RECHERCHE, { headers: entetes(), signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!page?.ok) return NextResponse.json({ error: "Recherche source injoignable", status: page?.status ?? 0 }, { status: 502 });
  const html = await page.text();
  const champ = (n: string) => {
    const m = html.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`));
    return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
  };

  for (const id of tranche) {
    const c = parId.get(id);
    if (!c?.city) continue;
    vues++;
    try {
      const corps = new URLSearchParams({
        __VIEWSTATE: champ("__VIEWSTATE"),
        __VIEWSTATEGENERATOR: champ("__VIEWSTATEGENERATOR"),
        __EVENTVALIDATION: champ("__EVENTVALIDATION"),
        __EVENTTARGET: "", __EVENTARGUMENT: "",
        "ctl00$ContentPlaceHolder_Content$TextBox_Keyword_Or_City_Calendar": String(c.city),
        "ctl00$ContentPlaceHolder_Content$DropDownList_Country_Calendar": "FR",
      });
      const rep = await fetch(RECHERCHE, {
        method: "POST", body: corps, signal: AbortSignal.timeout(25000),
        headers: { ...entetes(), "Content-Type": "application/x-www-form-urlencoded", Referer: RECHERCHE },
      });
      if (rep.ok) {
        const res = await rep.text();
        const liens = [...new Set([...res.matchAll(/href="(\/calendrier\/[^"]+)"/g)].map((m) => m[1]))];
        const fiche = choisirFiche(liens, { name: String(c.name ?? ""), date: String(c.date ?? "") });
        if (fiche) {
          appariees++;
          const nouveau = typeCorrige(c.type, typeDepuisUrl(fiche), Number(c.distance_km) || null);
          if (nouveau) {
            const { error: e } = await sb.from("races")
              .update({ type: nouveau, updated_at: new Date().toISOString() }).eq("id", id);
            if (!e) {
              corrigees++;
              if (details.length < 20) details.push({ course: String(c.name), de: String(c.type), vers: nouveau });
            }
          }
        }
      }
    } catch { /* réseau : on passe, le curseur avance quand même */ }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  const nouvelEtat = { curseur: suivant, corrigees: (etat.corrigees ?? 0) + corrigees, vues: (etat.vues ?? 0) + vues };
  const charge = {
    user_id: proprietaire, type: TYPE_ETAT,
    title: "Type de course — troisième source",
    body: `${nouvelEtat.vues} course(s) examinée(s) · ${nouvelEtat.corrigees} type(s) corrigé(s)`,
    data: nouvelEtat as unknown as Record<string, unknown>,
  };
  if (ligne?.id) await sb.from("notifications").update(charge).eq("id", ligne.id);
  else await sb.from("notifications").insert(charge);

  return NextResponse.json({ ok: true, total: ids.length, examinees: vues, appariees, corrigees, curseur: suivant, details });
}

function entetes(): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
  };
}

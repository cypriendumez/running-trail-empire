export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { idEditeur } from "@/lib/compta/enregistrer";
import { typeDepuisUrl, choisirFiche, typeCorrige, typePour, distancesDeFiche, distancesManquantes } from "@/lib/races/leSportif";
import { trancheAVerifier } from "@/lib/races/liens";
import { jourFrance } from "@/lib/races/jourFrance";

export const TYPE_ETAT = "races_types";
const BASE = "https://www.le-sportif.com";
const RECHERCHE = `${BASE}/Calendar/CalendarSearch.aspx`;
// ⚠️ LE LOT SEUL NE SUFFIT PAS, IL FAUT UNE ÉCHÉANCE. Mesuré en production : 115 s pour
// 25 courses, soit ~4,6 s chacune. Demander 100 d'un coup dépasserait les 300 s de la
// fonction : elle serait tuée en vol, le curseur ne serait JAMAIS enregistré, et les
// mêmes 100 courses seraient reprises chaque nuit indéfiniment — sans que rien ne le
// signale. On demande donc 100, mais on s'arrête à l'échéance en sauvant l'avancement
// réel. Deux passages par jour amènent le rythme à ~100 courses par nuit.
const LOT = 100;
const ECHEANCE_MS = 235_000;
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
  // ⚠️ PostgREST PLAFONNE À 1 000 LIGNES, quel que soit le `limit` demandé. Premier
  //    passage réel : `total: 1000` alors que le catalogue compte ~10 600 courses à
  //    venir — le curseur aurait tourné en rond sur le même millier, et les 90 % restants
  //    n'auraient JAMAIS été examinés. Aucune erreur n'est levée : la requête réussit,
  //    elle rend simplement moins que demandé.
  type Course = {
    id: string; name: string; city: string | null; date: string; distance_km: number | null; type: string;
    difficulty: string | null; department: string | null; region: string | null;
    registration_url: string | null; latitude: number | null; longitude: number | null; elevation_gain_m: number | null;
  };
  const courses: Course[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("races")
      .select("id,name,city,date,distance_km,type,difficulty,department,region,registration_url,latitude,longitude,elevation_gain_m")
      .gte("date", aujourdhui).lt("date", "2099-01-01")
      .not("city", "is", null).order("id").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    courses.push(...(data as typeof courses));
    if (data.length < 1000) break;
  }

  const { data: ligne } = await sb.from("notifications").select("id,data")
    .eq("user_id", proprietaire).eq("type", TYPE_ETAT).maybeSingle();
  const etat = (ligne?.data ?? {}) as { curseur?: number; corrigees?: number; vues?: number; ajoutees?: number };

  const ids = courses.map((c) => String(c.id));
  const { tranche, suivant } = trancheAVerifier(ids, etat.curseur ?? 0, LOT);
  const parId = new Map(courses.map((c) => [String(c.id), c]));

  let corrigees = 0, vues = 0, appariees = 0, ajoutees = 0;
  const details: { course: string; de: string; vers: string }[] = [];
  const ajouts: { course: string; km: number }[] = [];
  let refusees = 0;
  const erreurs: string[] = [];

  // Le formulaire ASP.NET exige un VIEWSTATE frais : on le reprend à chaque passage.
  const page = await fetch(RECHERCHE, { headers: entetes(), signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!page?.ok) return NextResponse.json({ error: "Recherche source injoignable", status: page?.status ?? 0 }, { status: 502 });
  const html = await page.text();
  const champ = (n: string) => {
    const m = html.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`));
    return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">") : "";
  };

  const debut = Date.now();
  let traitees = 0;
  for (const id of tranche) {
    // On s'arrête AVANT d'être tué, pour que le curseur reflète le travail réellement
    // fait. Un passage interrompu qui n'enregistre rien est pire qu'un passage court.
    if (Date.now() - debut > ECHEANCE_MS) break;
    traitees++;
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
        const fiche = choisirFiche(liens, { name: String(c.name ?? ""), date: String(c.date ?? ""), city: String(c.city ?? "") });
        if (fiche) {
          appariees++;
          const vu = typeDepuisUrl(fiche);
          const nouveau = typeCorrige(c.type, vu, Number(c.distance_km) || null);
          if (nouveau) {
            const { error: e } = await sb.from("races")
              .update({ type: nouveau, updated_at: new Date().toISOString() }).eq("id", id);
            if (!e) {
              corrigees++;
              if (details.length < 20) details.push({ course: String(c.name), de: String(c.type), vers: nouveau });
            }
          }

          // ── DISTANCES MANQUANTES ────────────────────────────────────────────────
          //  Mesuré sur un échantillon : 3 événements sur 5 ont des formats absents du
          //  catalogue. « 10 km d'Héricourt » n'existait qu'en 10 km alors que la course
          //  en propose quatre. Un athlète qui cherche un 5 km ne la trouvait pas.
          //
          //  ⚠️ ON N'AJOUTE JAMAIS SANS LA FICHE STRUCTURÉE de la source, et on ne
          //  SUPPRIME jamais rien. Une distance inventée deviendrait une course à
          //  laquelle personne ne peut s'inscrire — pire que la distance manquante.
          // ⚠️ LA FICHE DOIT ÊTRE UNE FICHE DE COURSE À PIED. le-sportif couvre aussi le
          //    vélo, le triathlon et la marche. « La Ronde Picarde » existe en course À
          //    PIED et en CYCLOSPORTIVE : même nom, même ville, même année — mon
          //    appariement a pris la seconde et lui a importé ses 41, 70, 75, 110 et
          //    150 km, enregistrés en « road_5k ». Un 110 km classé 5 km sur route, dans
          //    un catalogue de course à pied : c'est une donnée fausse ET absurde.
          //    `typeDepuisUrl` rend « inconnu » sur ces fiches-là ; on s'arrête ici.
          const fichePage = vu === "inconnu" ? null
            : await fetch(BASE + fiche, { headers: entetes(), signal: AbortSignal.timeout(20000) }).catch(() => null);
          if (fichePage?.ok) {
            const dSource = distancesDeFiche(await fichePage.text());
            if (dSource.length) {
              // Toutes les lignes de CET événement, pas seulement celle qu'on traite :
              // c'est l'ensemble des formats déjà connus qu'il faut comparer.
              const memes = courses.filter((x) =>
                x.name === c.name && x.city === c.city && x.date === c.date);
              const aAjouter = distancesManquantes(memes.map((x) => x.distance_km), dSource);
              for (const d of aAjouter) {
                // Le type se déduit du sport ET de la distance. `typeCorrige` ne
                // convient pas ici : elle ne répare qu'une incohérence route/trail et
                // rendait `null` sur une amorce déjà « cohérente », d'où des semis
                // enregistrés en « road_5k ».
                const t = typePour(vu, d);
                if (!t) continue;
                const { error: e } = await sb.from("races").insert({
                  name: c.name, city: c.city, department: c.department, region: c.region,
                  date: c.date, distance_km: d, type: t, difficulty: c.difficulty,
                  registration_url: c.registration_url,
                  latitude: c.latitude, longitude: c.longitude,
                });
                // ⚠️ UNE INSERTION REFUSÉE DOIT SE VOIR. Ce `if (!e)` seul a masqué
                // pendant deux jours que `typePour` rendait des types absents de l'enum
                // `race_type` : chaque semi et chaque marathon trouvés à la source
                // étaient refusés par la base, le compteur restait à zéro sur ces
                // lignes-là, et le rapport de fin annonçait un passage réussi.
                if (!e) { ajoutees++; if (ajouts.length < 20) ajouts.push({ course: String(c.name), km: d }); }
                else { refusees++; if (erreurs.length < 5) erreurs.push(`${c.name} ${d} km (${t}) : ${e.message}`); }
              }
            }
            await new Promise((r) => setTimeout(r, PAUSE_MS));
          }
        }
      }
    } catch { /* réseau : on passe, le curseur avance quand même */ }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  // Le curseur avance de ce qu'on a VRAIMENT parcouru, pas du lot demandé.
  const parcourus = trancheAVerifier(ids, etat.curseur ?? 0, traitees);
  const nouvelEtat = { curseur: parcourus.suivant, corrigees: (etat.corrigees ?? 0) + corrigees, vues: (etat.vues ?? 0) + vues, ajoutees: (etat.ajoutees ?? 0) + ajoutees };
  const charge = {
    user_id: proprietaire, type: TYPE_ETAT,
    title: "Type de course — troisième source",
    body: `${nouvelEtat.vues} course(s) examinée(s) · ${nouvelEtat.corrigees} type(s) corrigé(s) · ${nouvelEtat.ajoutees} distance(s) ajoutée(s)`,
    data: nouvelEtat as unknown as Record<string, unknown>,
  };
  /**
   * ⚠️ LE CURSEUR EST TOUT CE QUI FAIT AVANCER CE CRON.
   *
   * Son écriture n'était pas contrôlée. En échec, le curseur reste où il était et le
   * passage suivant retraite EXACTEMENT la même tranche — indéfiniment, en consommant
   * le quota Gemini à chaque fois, sans jamais parcourir le catalogue. Le cron
   * répondrait « ok » à chaque exécution tout en tournant sur place : la panne la plus
   * difficile à voir, parce que tous les voyants sont au vert.
   */
  const { error: eCurseur } = ligne?.id
    ? await sb.from("notifications").update(charge).eq("id", ligne.id)
    : await sb.from("notifications").insert(charge);
  if (eCurseur) {
    console.error("[races-types] curseur non enregistré, la prochaine exécution repartira du même point :", eCurseur.message);
    return NextResponse.json({ ok: false, erreur: "curseur non enregistré", total: ids.length }, { status: 500 });
  }

  return NextResponse.json({
    ok: refusees === 0, total: ids.length, demandees: tranche.length, traitees, examinees: vues,
    appariees, corrigees, ajoutees, refusees, curseur: parcourus.suivant, secondes: Math.round((Date.now() - debut) / 1000),
    details, ajouts, erreurs,
  });
}

function entetes(): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
  };
}

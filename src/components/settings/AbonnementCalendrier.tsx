"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Copy, Loader2, RefreshCw, Unlink } from "lucide-react";
import type { Lang } from "@/lib/i18n/base";

/**
 * MES SÉANCES DANS MON AGENDA (27/11/2026) — Paramètres → Connexions.
 *
 * Le coureur crée une adresse secrète, puis l'ajoute à Apple Calendrier (lien `webcal://`, qui
 * ouvre l'application), à Google Agenda (page d'ajout par URL) ou ailleurs (lien copié). Ses
 * séances y arrivent à midi ; voir lib/calendrier/ics.ts.
 *
 * ⚠️ L'ADRESSE NE S'AFFICHE QU'UNE FOIS : le serveur n'en garde que l'empreinte. Perdue, on en
 * crée une nouvelle, ce qui coupe l'ancienne — c'est dit avant de cliquer.
 */
type Etat =
  | { k: "lecture" }
  | { k: "illisible" }
  | { k: "indisponible" }
  | { k: "inactif" }
  | { k: "actif"; creeLe: string | null; derniereLecture: string | null }
  | { k: "nouveau"; https: string; webcal: string; google: string };

const L: Record<Lang, Record<string, string>> = {
  fr: {
    titre: "Mes séances dans mon agenda", desc: "Apple Calendrier, Google Agenda, Outlook… Tes séances y apparaissent à midi (18 h pour une seconde séance le même jour) et suivent chaque mise à jour du plan.",
    activer: "Créer mon lien d'agenda", apple: "Ajouter à Apple Calendrier", google: "Ajouter à Google Agenda", copier: "Copier le lien", copie: "Lien copié",
    unique: "Ce lien ne s'affichera qu'une fois. Garde-le pour toi : qui le possède voit tes séances.",
    autres: "Outlook et autres agendas : « Ajouter un calendrier » › « Depuis Internet », puis colle le lien.",
    delai: "Ton agenda relit le lien à son rythme : quelques minutes sur iPhone et Mac, parfois plusieurs heures sur Google Agenda.",
    contenu: "Seuls le type de chaque séance (footing, sortie longue…) et sa durée partent dans ton agenda. Le détail, les allures et tout ce qui touche à ta santé restent dans Pacevo.",
    actif: "Lien actif depuis le {d}.", lu: "Dernière lecture par ton agenda : {d}.", jamaisLu: "Ton agenda ne l'a pas encore relu.",
    nouveauLien: "Créer un nouveau lien", confirmeNouveau: "L'ancien lien cessera de marcher : il faudra ajouter le nouveau à ton agenda. Continuer ?",
    arreter: "Arrêter", confirmeArret: "Ton agenda ne recevra plus tes séances. Continuer ?", arrete: "Lien révoqué",
    indispo: "Bientôt disponible.", erreur: "Échec, réessaie.", illisible: "État illisible pour le moment, réessaie plus tard.",
  },
  en: {
    titre: "My sessions in my calendar", desc: "Apple Calendar, Google Calendar, Outlook… Your sessions show up at noon (6 pm for a second session on the same day) and follow every plan update.",
    activer: "Create my calendar link", apple: "Add to Apple Calendar", google: "Add to Google Calendar", copier: "Copy link", copie: "Link copied",
    unique: "This link is shown only once. Keep it to yourself: anyone who has it can see your sessions.",
    autres: "Outlook and other calendars: “Add calendar” › “From the internet”, then paste the link.",
    delai: "Your calendar re-reads the link at its own pace: a few minutes on iPhone and Mac, sometimes several hours on Google Calendar.",
    contenu: "Only each session's type (easy run, long run…) and duration go to your calendar. The details, your paces and anything about your health stay in Pacevo.",
    actif: "Link active since {d}.", lu: "Last read by your calendar: {d}.", jamaisLu: "Your calendar hasn't read it yet.",
    nouveauLien: "Create a new link", confirmeNouveau: "The old link will stop working: you'll need to add the new one to your calendar. Continue?",
    arreter: "Stop", confirmeArret: "Your calendar will no longer receive your sessions. Continue?", arrete: "Link revoked",
    indispo: "Coming soon.", erreur: "Failed, try again.", illisible: "Status unavailable for now, try again later.",
  },
  de: {
    titre: "Meine Einheiten im Kalender", desc: "Apple Kalender, Google Kalender, Outlook… Deine Einheiten erscheinen mittags (18 Uhr für eine zweite Einheit am selben Tag) und folgen jeder Planänderung.",
    activer: "Kalenderlink erstellen", apple: "Zu Apple Kalender hinzufügen", google: "Zu Google Kalender hinzufügen", copier: "Link kopieren", copie: "Link kopiert",
    unique: "Dieser Link wird nur einmal angezeigt. Behalte ihn für dich: Wer ihn hat, sieht deine Einheiten.",
    autres: "Outlook und andere Kalender: „Kalender hinzufügen“ › „Aus dem Internet“, dann den Link einfügen.",
    delai: "Dein Kalender liest den Link in seinem eigenen Takt: wenige Minuten auf iPhone und Mac, manchmal mehrere Stunden bei Google Kalender.",
    contenu: "Nur die Art jeder Einheit (lockerer Lauf, langer Lauf…) und ihre Dauer gehen in deinen Kalender. Details, Tempi und alles zu deiner Gesundheit bleiben in Pacevo.",
    actif: "Link aktiv seit {d}.", lu: "Zuletzt von deinem Kalender gelesen: {d}.", jamaisLu: "Dein Kalender hat ihn noch nicht gelesen.",
    nouveauLien: "Neuen Link erstellen", confirmeNouveau: "Der alte Link funktioniert dann nicht mehr: Du musst den neuen in deinem Kalender hinzufügen. Fortfahren?",
    arreter: "Beenden", confirmeArret: "Dein Kalender erhält deine Einheiten nicht mehr. Fortfahren?", arrete: "Link widerrufen",
    indispo: "Bald verfügbar.", erreur: "Fehlgeschlagen, versuch es erneut.", illisible: "Status gerade nicht lesbar, versuch es später.",
  },
  es: {
    titre: "Mis sesiones en mi calendario", desc: "Calendario de Apple, Google Calendar, Outlook… Tus sesiones aparecen a mediodía (a las 18 h si hay una segunda el mismo día) y siguen cada actualización del plan.",
    activer: "Crear mi enlace de calendario", apple: "Añadir al Calendario de Apple", google: "Añadir a Google Calendar", copier: "Copiar el enlace", copie: "Enlace copiado",
    unique: "Este enlace solo se muestra una vez. Guárdalo para ti: quien lo tenga ve tus sesiones.",
    autres: "Outlook y otros calendarios: «Añadir calendario» › «Desde Internet», y pega el enlace.",
    delai: "Tu calendario vuelve a leer el enlace a su ritmo: unos minutos en iPhone y Mac, a veces varias horas en Google Calendar.",
    contenu: "Solo el tipo de cada sesión (rodaje suave, tirada larga…) y su duración van a tu calendario. El detalle, tus ritmos y todo lo relativo a tu salud se quedan en Pacevo.",
    actif: "Enlace activo desde el {d}.", lu: "Última lectura de tu calendario: {d}.", jamaisLu: "Tu calendario aún no lo ha leído.",
    nouveauLien: "Crear un enlace nuevo", confirmeNouveau: "El enlace antiguo dejará de funcionar: tendrás que añadir el nuevo a tu calendario. ¿Continuar?",
    arreter: "Detener", confirmeArret: "Tu calendario dejará de recibir tus sesiones. ¿Continuar?", arrete: "Enlace revocado",
    indispo: "Próximamente.", erreur: "Error, inténtalo de nuevo.", illisible: "Estado no disponible por ahora, inténtalo más tarde.",
  },
  pt: {
    titre: "As minhas sessões no meu calendário", desc: "Calendário da Apple, Google Calendar, Outlook… As tuas sessões aparecem ao meio-dia (às 18 h se houver uma segunda no mesmo dia) e acompanham cada atualização do plano.",
    activer: "Criar o meu link de calendário", apple: "Adicionar ao Calendário da Apple", google: "Adicionar ao Google Calendar", copier: "Copiar o link", copie: "Link copiado",
    unique: "Este link só é mostrado uma vez. Guarda-o para ti: quem o tiver vê as tuas sessões.",
    autres: "Outlook e outros calendários: «Adicionar calendário» › «A partir da Internet», e cola o link.",
    delai: "O teu calendário volta a ler o link ao seu ritmo: alguns minutos no iPhone e no Mac, por vezes várias horas no Google Calendar.",
    contenu: "Só o tipo de cada sessão (corrida fácil, longo…) e a sua duração vão para o teu calendário. O detalhe, os teus ritmos e tudo o que diz respeito à tua saúde ficam no Pacevo.",
    actif: "Link ativo desde {d}.", lu: "Última leitura pelo teu calendário: {d}.", jamaisLu: "O teu calendário ainda não o leu.",
    nouveauLien: "Criar um link novo", confirmeNouveau: "O link antigo deixará de funcionar: terás de adicionar o novo ao teu calendário. Continuar?",
    arreter: "Parar", confirmeArret: "O teu calendário deixará de receber as tuas sessões. Continuar?", arrete: "Link revogado",
    indispo: "Disponível em breve.", erreur: "Falhou, tenta de novo.", illisible: "Estado indisponível de momento, tenta mais tarde.",
  },
};

const bouton = "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40";

export function AbonnementCalendrier({ lang }: { lang: Lang }) {
  const t = (k: string, d?: string) => (L[lang]?.[k] ?? L.fr[k]).replace("{d}", d ?? "");
  const [etat, setEtat] = useState<Etat>({ k: "lecture" });
  const [occupe, setOccupe] = useState(false);
  const date = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  async function relire() {
    try {
      const r = await fetch("/api/calendrier/abonnement", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setEtat({ k: "illisible" }); return; }
      if (j.indisponible) setEtat({ k: "indisponible" });
      else if (j.actif) setEtat({ k: "actif", creeLe: j.creeLe ?? null, derniereLecture: j.derniereLecture ?? null });
      else setEtat({ k: "inactif" });
    } catch { setEtat({ k: "illisible" }); }
  }
  useEffect(() => { void relire(); }, []);

  async function creer(remplace: boolean) {
    if (remplace && !window.confirm(t("confirmeNouveau"))) return;
    setOccupe(true);
    try {
      const r = await fetch("/api/calendrier/abonnement", { method: "POST" });
      const j = await r.json();
      if (j.indisponible) { setEtat({ k: "indisponible" }); return; }
      if (!r.ok || !j.webcal) { toast.error(t("erreur")); return; }
      setEtat({ k: "nouveau", https: j.https, webcal: j.webcal, google: j.google });
    } catch { toast.error(t("erreur")); }
    finally { setOccupe(false); }
  }

  async function arreter() {
    if (!window.confirm(t("confirmeArret"))) return;
    setOccupe(true);
    try {
      const r = await fetch("/api/calendrier/abonnement", { method: "DELETE" });
      if (!r.ok) { toast.error(t("erreur")); return; }
      toast.success(t("arrete"));
      setEtat({ k: "inactif" });
    } catch { toast.error(t("erreur")); }
    finally { setOccupe(false); }
  }

  async function copier(url: string) {
    try { await navigator.clipboard.writeText(url); toast.success(t("copie")); }
    catch { window.prompt(t("copier"), url); }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">{t("titre")}</h2>
      <p className="mt-0.5 text-sm text-zinc-500">{t("desc")}</p>
      <div className="mt-4 space-y-3">
        {etat.k === "lecture" && <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}
        {etat.k === "illisible" && <p className="text-sm text-zinc-500">{t("illisible")}</p>}
        {etat.k === "indisponible" && <p className="text-sm text-zinc-500">{t("indispo")}</p>}

        {etat.k === "inactif" && (
          <button onClick={() => creer(false)} disabled={occupe} className={`${bouton} bg-zinc-900 text-white hover:bg-zinc-800`}>
            {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} {t("activer")}
          </button>
        )}

        {etat.k === "nouveau" && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <a href={etat.webcal} className={`${bouton} bg-zinc-900 text-white hover:bg-zinc-800`}><CalendarPlus className="h-4 w-4" /> {t("apple")}</a>
              <a href={etat.google} target="_blank" rel="noopener noreferrer" className={`${bouton} border border-zinc-200 text-zinc-700 hover:bg-zinc-50`}><CalendarPlus className="h-4 w-4" /> {t("google")}</a>
              <button onClick={() => copier(etat.https)} className={`${bouton} border border-zinc-200 text-zinc-700 hover:bg-zinc-50`}><Copy className="h-4 w-4" /> {t("copier")}</button>
            </div>
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 ring-1 ring-amber-100">{t("unique")}</p>
            <p className="text-xs text-zinc-500">{t("autres")}</p>
          </>
        )}

        {etat.k === "actif" && (
          <>
            <p className="text-sm text-zinc-700">
              {t("actif", date(etat.creeLe))}{" "}
              <span className="text-zinc-500">{etat.derniereLecture ? t("lu", date(etat.derniereLecture)) : t("jamaisLu")}</span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => creer(true)} disabled={occupe} className={`${bouton} border border-zinc-200 text-zinc-700 hover:bg-zinc-50`}><RefreshCw className="h-4 w-4" /> {t("nouveauLien")}</button>
              <button onClick={arreter} disabled={occupe} className={`${bouton} border border-red-200 text-red-700 hover:bg-red-50`}><Unlink className="h-4 w-4" /> {t("arreter")}</button>
            </div>
          </>
        )}

        {(etat.k === "nouveau" || etat.k === "actif" || etat.k === "inactif") && (
          <p className="text-xs text-zinc-400">{t("delai")} {t("contenu")}</p>
        )}
      </div>
    </section>
  );
}

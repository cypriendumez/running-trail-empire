"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import type { Lang } from "@/lib/i18n/base";

/**
 * MES SÉANCES DANS MON AGENDA — Paramètres → Connexions.
 *
 * RÈGLE (Cyprien, 28/11/2026) : « des parents qui n'y connaissent rien doivent savoir le faire ».
 * Donc DEUX gros boutons, Calendrier Apple et Google Agenda, celui de l'appareil en premier, qui
 * marchent du premier coup et à chaque visite : le lien se recalcule (jeton dérivé, voir
 * lib/calendrier/jeton.ts), il n'y a rien à garder ni à recopier, et appuyer deux fois ou sur un
 * autre appareil ne coupe jamais un agenda déjà relié. L'aide est repliée sous « Je ne vois pas
 * mes séances » ; « Changer de lien » et « Arrêter » sont discrets, en bas.
 *
 * Défaut d'origine : le premier lien ne s'affichait qu'une fois ; Cyprien en a recréé un pour son
 * iPhone, ce qui a coupé celui de Google, resté vide. Et un gros bouton « Copier le lien »
 * semblait ne servir à rien : il n'est plus qu'un lien discret pour Outlook et les autres agendas.
 */
type Liens = { https: string; webcal: string; google: string; outlook: string; outlookPro: string };
/** Ce qu'un bouton ouvre : Apple, Google, Outlook.com ou Outlook d'un compte de travail. */
type Cible = "webcal" | "google" | "outlook" | "outlookPro";
type Etat =
  | { k: "lecture" }
  | { k: "illisible" }
  | { k: "indisponible" }
  // `rappel` : un lien vient d'être remplacé ; l'ancien calendrier, mort, reste dans l'agenda tant que le
  // coureur ne l'a pas supprimé. Le rappel RESTE affiché (un toast s'effaçait en quittant la page).
  | { k: "pret"; actif: boolean; derniereLecture: string | null; liens: Liens | null; rappel?: boolean };
type Appareil = "apple" | "android" | "autre";

const L: Record<Lang, Record<string, string>> = {
  fr: {
    titre: "Mes séances dans mon agenda", desc: "Tes séances s'ajoutent toutes seules à ton agenda, à midi, et se mettent à jour quand ton plan change (de quelques minutes à quelques heures selon l'agenda). Choisis ton agenda :",
    apple: "Calendrier Apple", appleSous: "iPhone, iPad, Mac", google: "Google Agenda", googleSous: "Android, Gmail",
    autres: "Un autre agenda ?", copier: "Copier le lien", copie: "Lien copié",
    relie: "Ton agenda reçoit tes séances (dernière lecture : {d}).", attente: "Ton agenda n'a pas encore lu tes séances. S'il te demande de confirmer, accepte.",
    ancien: "Ton lien actuel ne peut pas être réaffiché. Touche ton agenda ci-dessus pour en créer un nouveau, puis supprime l'ancien calendrier « Pacevo · séances » de ton agenda.",
    aide: "Je ne vois pas mes séances",
    delai: "Patiente un peu : l'iPhone met quelques minutes, Google parfois plusieurs heures.",
    googleTel: "Google Agenda sur téléphone : ouvre le menu ☰ et coche « Pacevo · séances ». Sur Android, ouvre aussi Paramètres, touche « Pacevo · séances » et active la synchronisation.",
    googleOrdi: "Si, sur ton téléphone, Google n'affiche pas de bouton pour ajouter l'agenda, fais-le une fois depuis un ordinateur (pacevo.fr › Paramètres › Connexions) : il arrive ensuite tout seul sur le téléphone.",
    iphone: "Sur iPhone, Google ne transmet pas toujours ce calendrier à l'app Calendrier : pour elle, touche « Calendrier Apple ».",
    contenu: "Seuls le type de chaque séance (footing, sortie longue…) et sa durée partent dans ton agenda. Le détail, les allures et tout ce qui touche à ta santé restent dans Pacevo.",
    changer: "Changer de lien", confirmeChanger: "Ton lien actuel cessera de marcher : il faudra rajouter Pacevo à chacun de tes agendas. À faire seulement si tu as partagé ton lien par erreur. Continuer ?",
    confirmeAncien: "Un nouveau lien va remplacer l'ancien, qui cessera de marcher. Continuer ?",
    rappel: "Nouveau lien prêt. Supprime l'ancien calendrier « Pacevo · séances » de ton agenda, puis touche ton agenda ci-dessus pour ajouter le nouveau.",
    ordiConfirme: "Sur ordinateur, Google te demande de confirmer l'ajout : accepte.",
    depuisLien: "Ce lien s'ajoute à un agenda, pas dans le navigateur : touche simplement ton agenda ci-dessous.",
    outlookBouton: "Outlook",
    outlookSous: "Outlook.com, Hotmail, Live",
    pro: "Compte de travail ou d'école ?",
    proLien: "Outlook professionnel",
    outlookTel: "Sur téléphone, Outlook ne permet pas d'ajouter ce calendrier : fais-le une fois depuis un ordinateur, il arrivera ensuite tout seul dans l'appli Outlook.",
    outlookAppli: "Appli Outlook installée (Mac, Windows) : elle ne sait pas ajouter ce calendrier elle-même. Touche le bouton « Outlook » ci-dessus : le calendrier arrivera ensuite tout seul dans l'appli. N'utilise pas « Importer ICS », qui ferait une copie qui ne se met jamais à jour.",
    outlookConnexion: "Outlook te demande de te connecter ? Connecte-toi : le calendrier devrait s'ajouter juste après.",
    arreter: "Arrêter l'envoi", confirmeArret: "Ton agenda ne recevra plus tes séances. Continuer ?", arrete: "Envoi arrêté. Tu peux supprimer le calendrier « Pacevo · séances » de ton agenda.",
    indispo: "Bientôt disponible.", erreur: "Échec, réessaie.", illisible: "État illisible pour le moment, réessaie plus tard.",
  },
  en: {
    titre: "My sessions in my calendar", desc: "Your sessions are added automatically to your calendar, at noon, and update when your plan changes (from a few minutes to a few hours depending on the calendar). Choose your calendar:",
    apple: "Apple Calendar", appleSous: "iPhone, iPad, Mac", google: "Google Calendar", googleSous: "Android, Gmail",
    autres: "Another calendar?", copier: "Copy link", copie: "Link copied",
    relie: "Your calendar is receiving your sessions (last read: {d}).", attente: "Your calendar hasn't read your sessions yet. If it asks you to confirm, accept.",
    ancien: "Your current link can't be shown again. Tap your calendar above to create a new one, then delete the old “Pacevo · sessions” calendar from your calendar app.",
    aide: "I can't see my sessions",
    delai: "Give it a moment: iPhone takes a few minutes, Google sometimes several hours.",
    googleTel: "Google Calendar on your phone: open the ☰ menu and tick “Pacevo · sessions”. On Android, also open Settings, tap “Pacevo · sessions” and turn on sync.",
    googleOrdi: "If Google shows no button to add the calendar on your phone, do it once from a computer (pacevo.fr › Settings › Connections): it then reaches your phone by itself.",
    iphone: "On iPhone, Google doesn't always pass this calendar on to the Calendar app: for that app, tap “Apple Calendar”.",
    contenu: "Only each session's type (easy run, long run…) and duration go to your calendar. The details, your paces and anything about your health stay in Pacevo.",
    changer: "Change link", confirmeChanger: "Your current link will stop working: you'll need to add Pacevo to each of your calendars again. Only do this if you shared your link by mistake. Continue?",
    confirmeAncien: "A new link will replace the old one, which will stop working. Continue?",
    rappel: "New link ready. Delete the old “Pacevo · sessions” calendar from your calendar app, then tap your calendar above to add the new one.",
    ordiConfirme: "On a computer, Google asks you to confirm adding the calendar: accept.",
    depuisLien: "This link goes into a calendar, not the browser: just tap your calendar below.",
    outlookBouton: "Outlook",
    outlookSous: "Outlook.com, Hotmail, Live",
    pro: "Work or school account?",
    proLien: "Outlook for work",
    outlookTel: "On a phone, Outlook can't add this calendar: do it once from a computer, and it will then show up in the Outlook app by itself.",
    outlookAppli: "Outlook app installed (Mac, Windows): it can't add this calendar by itself. Tap the “Outlook” button above: it will then show up in the app on its own. Don't use “Import ICS”, which makes a copy that never updates.",
    outlookConnexion: "Outlook asks you to sign in? Sign in: the calendar should be added right after.",
    arreter: "Stop sending", confirmeArret: "Your calendar will no longer receive your sessions. Continue?", arrete: "Sending stopped. You can delete the “Pacevo · sessions” calendar from your calendar app.",
    indispo: "Coming soon.", erreur: "Failed, try again.", illisible: "Status unavailable for now, try again later.",
  },
  de: {
    titre: "Meine Einheiten im Kalender", desc: "Deine Einheiten landen automatisch mittags in deinem Kalender und aktualisieren sich, wenn sich dein Plan ändert (je nach Kalender nach wenigen Minuten bis einigen Stunden). Wähle deinen Kalender:",
    apple: "Apple Kalender", appleSous: "iPhone, iPad, Mac", google: "Google Kalender", googleSous: "Android, Gmail",
    autres: "Ein anderer Kalender?", copier: "Link kopieren", copie: "Link kopiert",
    relie: "Dein Kalender erhält deine Einheiten (zuletzt gelesen: {d}).", attente: "Dein Kalender hat deine Einheiten noch nicht gelesen. Wenn er um Bestätigung bittet, stimme zu.",
    ancien: "Dein aktueller Link kann nicht erneut angezeigt werden. Tippe oben auf deinen Kalender, um einen neuen zu erstellen, und lösche dann den alten Kalender „Pacevo · Einheiten“.",
    aide: "Ich sehe meine Einheiten nicht",
    delai: "Etwas Geduld: Das iPhone braucht ein paar Minuten, Google manchmal mehrere Stunden.",
    googleTel: "Google Kalender auf dem Handy: Öffne das Menü ☰ und hake „Pacevo · Einheiten“ an. Unter Android öffne außerdem die Einstellungen, tippe auf „Pacevo · Einheiten“ und aktiviere die Synchronisierung.",
    googleOrdi: "Zeigt Google auf deinem Handy keine Schaltfläche zum Hinzufügen, mach es einmal am Computer (pacevo.fr › Einstellungen › Verbindungen): Der Kalender kommt danach von selbst aufs Handy.",
    iphone: "Auf dem iPhone gibt Google diesen Kalender nicht immer an die Kalender-App weiter: Tippe dafür auf „Apple Kalender“.",
    contenu: "Nur die Art jeder Einheit (lockerer Lauf, langer Lauf…) und ihre Dauer gehen in deinen Kalender. Details, Tempi und alles zu deiner Gesundheit bleiben in Pacevo.",
    changer: "Link ändern", confirmeChanger: "Dein aktueller Link funktioniert dann nicht mehr: Du musst Pacevo in jedem deiner Kalender neu hinzufügen. Nur nötig, wenn du deinen Link versehentlich geteilt hast. Fortfahren?",
    confirmeAncien: "Ein neuer Link ersetzt den alten, der dann nicht mehr funktioniert. Fortfahren?",
    rappel: "Neuer Link bereit. Lösche den alten Kalender „Pacevo · Einheiten“ aus deiner Kalender-App und tippe dann oben auf deinen Kalender, um den neuen hinzuzufügen.",
    ordiConfirme: "Am Computer bittet Google dich, das Hinzufügen zu bestätigen: Stimme zu.",
    depuisLien: "Dieser Link gehört in einen Kalender, nicht in den Browser: Tippe einfach unten auf deinen Kalender.",
    outlookBouton: "Outlook",
    outlookSous: "Outlook.com, Hotmail, Live",
    pro: "Arbeits- oder Schulkonto?",
    proLien: "Outlook für die Arbeit",
    outlookTel: "Am Handy kann Outlook diesen Kalender nicht hinzufügen: Mach es einmal am Computer, danach erscheint er von selbst in der Outlook-App.",
    outlookAppli: "Installierte Outlook-App (Mac, Windows): Sie kann diesen Kalender nicht selbst hinzufügen. Tippe oben auf „Outlook“: Danach erscheint er von selbst in der App. Nutze nicht „ICS importieren“, das wäre eine Kopie, die sich nie aktualisiert.",
    outlookConnexion: "Outlook bittet dich um Anmeldung? Melde dich an: Der Kalender sollte gleich danach hinzugefügt werden.",
    arreter: "Senden beenden", confirmeArret: "Dein Kalender erhält deine Einheiten nicht mehr. Fortfahren?", arrete: "Senden beendet. Du kannst den Kalender „Pacevo · Einheiten“ aus deiner Kalender-App löschen.",
    indispo: "Bald verfügbar.", erreur: "Fehlgeschlagen, versuch es erneut.", illisible: "Status gerade nicht lesbar, versuch es später.",
  },
  es: {
    titre: "Mis sesiones en mi calendario", desc: "Tus sesiones se añaden solas a tu calendario, a mediodía, y se actualizan cuando cambia tu plan (de unos minutos a unas horas según el calendario). Elige tu calendario:",
    apple: "Calendario de Apple", appleSous: "iPhone, iPad, Mac", google: "Google Calendar", googleSous: "Android, Gmail",
    autres: "¿Otro calendario?", copier: "Copiar el enlace", copie: "Enlace copiado",
    relie: "Tu calendario recibe tus sesiones (última lectura: {d}).", attente: "Tu calendario aún no ha leído tus sesiones. Si te pide confirmar, acepta.",
    ancien: "Tu enlace actual no se puede volver a mostrar. Toca tu calendario arriba para crear uno nuevo y luego borra el antiguo calendario «Pacevo · sesiones».",
    aide: "No veo mis sesiones",
    delai: "Ten un poco de paciencia: el iPhone tarda unos minutos, Google a veces varias horas.",
    googleTel: "Google Calendar en el móvil: abre el menú ☰ y marca «Pacevo · sesiones». En Android, abre también Ajustes, toca «Pacevo · sesiones» y activa la sincronización.",
    googleOrdi: "Si en tu móvil Google no muestra ningún botón para añadir el calendario, hazlo una vez desde un ordenador (pacevo.fr › Ajustes › Conexiones): luego llega solo al móvil.",
    iphone: "En el iPhone, Google no siempre pasa este calendario a la app Calendario: para ella, toca «Calendario de Apple».",
    contenu: "Solo el tipo de cada sesión (rodaje suave, tirada larga…) y su duración van a tu calendario. El detalle, tus ritmos y todo lo relativo a tu salud se quedan en Pacevo.",
    changer: "Cambiar de enlace", confirmeChanger: "Tu enlace actual dejará de funcionar: tendrás que volver a añadir Pacevo a cada uno de tus calendarios. Hazlo solo si compartiste tu enlace por error. ¿Continuar?",
    confirmeAncien: "Un enlace nuevo sustituirá al antiguo, que dejará de funcionar. ¿Continuar?",
    rappel: "Enlace nuevo listo. Borra el antiguo calendario «Pacevo · sesiones» de tu app de calendario y luego toca tu calendario arriba para añadir el nuevo.",
    ordiConfirme: "En el ordenador, Google te pide confirmar que lo añades: acepta.",
    depuisLien: "Este enlace se añade a un calendario, no al navegador: toca tu calendario aquí abajo.",
    outlookBouton: "Outlook",
    outlookSous: "Outlook.com, Hotmail, Live",
    pro: "¿Cuenta del trabajo o de estudios?",
    proLien: "Outlook profesional",
    outlookTel: "En el móvil, Outlook no permite añadir este calendario: hazlo una vez desde un ordenador y luego aparecerá solo en la app de Outlook.",
    outlookAppli: "App de Outlook instalada (Mac, Windows): no puede añadir este calendario por sí sola. Toca el botón «Outlook» de arriba: luego aparecerá solo en la app. No uses «Importar ICS», que haría una copia que nunca se actualiza.",
    outlookConnexion: "¿Outlook te pide iniciar sesión? Hazlo: el calendario debería añadirse justo después.",
    arreter: "Dejar de enviar", confirmeArret: "Tu calendario dejará de recibir tus sesiones. ¿Continuar?", arrete: "Envío detenido. Puedes borrar el calendario «Pacevo · sesiones» de tu app de calendario.",
    indispo: "Próximamente.", erreur: "Error, inténtalo de nuevo.", illisible: "Estado no disponible por ahora, inténtalo más tarde.",
  },
  pt: {
    titre: "As minhas sessões no meu calendário", desc: "As tuas sessões entram sozinhas no teu calendário, ao meio-dia, e atualizam-se quando o teu plano muda (de alguns minutos a algumas horas, conforme o calendário). Escolhe o teu calendário:",
    apple: "Calendário da Apple", appleSous: "iPhone, iPad, Mac", google: "Google Agenda", googleSous: "Android, Gmail",
    autres: "Outro calendário?", copier: "Copiar o link", copie: "Link copiado",
    relie: "O teu calendário recebe as tuas sessões (última leitura: {d}).", attente: "O teu calendário ainda não leu as tuas sessões. Se pedir para confirmar, aceita.",
    ancien: "O teu link atual não pode voltar a ser mostrado. Toca no teu calendário acima para criar um novo e depois apaga o antigo calendário «Pacevo · sessões».",
    aide: "Não vejo as minhas sessões",
    delai: "Tem um pouco de paciência: o iPhone demora alguns minutos, a Google por vezes várias horas.",
    googleTel: "Google Agenda no telemóvel: abre o menu ☰ e marca «Pacevo · sessões». No Android, abre também as Definições, toca em «Pacevo · sessões» e ativa a sincronização.",
    googleOrdi: "Se no telemóvel a Google não mostrar nenhum botão para adicionar o calendário, fá-lo uma vez num computador (pacevo.fr › Definições › Ligações): depois chega sozinho ao telemóvel.",
    iphone: "No iPhone, a Google nem sempre passa este calendário para a app Calendário: para ela, toca em «Calendário da Apple».",
    contenu: "Só o tipo de cada sessão (corrida fácil, corrida longa…) e a sua duração vão para o teu calendário. O detalhe, os teus ritmos e tudo o que diz respeito à tua saúde ficam no Pacevo.",
    changer: "Mudar de link", confirmeChanger: "O teu link atual deixará de funcionar: terás de voltar a adicionar o Pacevo a cada um dos teus calendários. Faz isto só se partilhaste o teu link por engano. Continuar?",
    confirmeAncien: "Um link novo vai substituir o antigo, que deixará de funcionar. Continuar?",
    rappel: "Link novo pronto. Apaga o antigo calendário «Pacevo · sessões» da tua app de calendário e depois toca no teu calendário acima para adicionar o novo.",
    ordiConfirme: "No computador, a Google pede-te para confirmar a adição: aceita.",
    depuisLien: "Este link adiciona-se a um calendário, não ao navegador: toca no teu calendário aqui em baixo.",
    outlookBouton: "Outlook",
    outlookSous: "Outlook.com, Hotmail, Live",
    pro: "Conta de trabalho ou escola?",
    proLien: "Outlook profissional",
    outlookTel: "No telemóvel, o Outlook não permite adicionar este calendário: fá-lo uma vez num computador e depois aparecerá sozinho na app do Outlook.",
    outlookAppli: "App do Outlook instalada (Mac, Windows): não consegue adicionar este calendário sozinha. Toca no botão «Outlook» acima: depois aparece sozinho na app. Não uses «Importar ICS», que faria uma cópia que nunca se atualiza.",
    outlookConnexion: "O Outlook pede-te para iniciar sessão? Inicia sessão: o calendário deve ser adicionado logo a seguir.",
    arreter: "Parar o envio", confirmeArret: "O teu calendário deixará de receber as tuas sessões. Continuar?", arrete: "Envio parado. Podes apagar o calendário «Pacevo · sessões» da tua app de calendário.",
    indispo: "Disponível em breve.", erreur: "Falhou, tenta de novo.", illisible: "Estado indisponível de momento, tenta mais tarde.",
  },
};


const gros = "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors disabled:opacity-40 sm:flex-1";
const discret = "font-semibold underline underline-offset-2 disabled:opacity-40";

export function AbonnementCalendrier({ lang }: { lang: Lang }) {
  const t = (k: string, d?: string) => (L[lang]?.[k] ?? L.fr[k]).replace("{d}", d ?? "");
  const [etat, setEtat] = useState<Etat>({ k: "lecture" });
  const [occupe, setOccupe] = useState(false);
  const [enCours, setEnCours] = useState<Cible | null>(null);
  const [mobile, setMobile] = useState(false);
  // Le bouton de l'appareil passe devant : Apple sur iPhone, iPad (qui se dit « Macintosh ») et Mac,
  // Google ailleurs (Android, Windows…). L'aide repliée ne montre que ce qui concerne l'appareil.
  const [appareil, setAppareil] = useState<Appareil>("apple");
  // Arrivé ici en ouvrant le lien d'agenda dans un navigateur (lib/calendrier/navigateur.ts) : on dit pourquoi.
  const [depuisLien, setDepuisLien] = useState(false);
  const section = useRef<HTMLElement>(null);
  const appleDabord = appareil === "apple";
  const date = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  // Chaque action (créer, changer, arrêter) avance ce compteur : une relecture partie AVANT elle
  // et revenue après ne doit pas remettre à l'écran un lien qu'on vient d'arrêter ou de changer.
  const generation = useRef(0);

  async function relire() {
    const g = generation.current;
    // Une relecture ratée (retour de l'app Calendrier, réseau pas encore revenu) ne fait pas
    // disparaître des boutons qui marchent : « illisible » seulement tant que rien n'est affiché.
    const rate = () => { if (g === generation.current) setEtat((e) => (e.k === "pret" ? e : { k: "illisible" })); };
    try {
      const r = await fetch("/api/calendrier/abonnement", { cache: "no-store" });
      const j = await r.json();
      if (g !== generation.current) return;
      if (!r.ok) { rate(); return; }
      if (j.indisponible) { setEtat({ k: "indisponible" }); return; }
      setEtat((e) => ({ k: "pret", actif: !!j.actif, derniereLecture: j.derniereLecture ?? null, liens: j.liens ?? null, rappel: e.k === "pret" && !!e.rappel && !!j.liens }));
    } catch { rate(); }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("agenda") === "lien") {
      setDepuisLien(true);
      section.current?.scrollIntoView({ block: "start" });
    }
    const ua = navigator.userAgent;
    setAppareil(/iPhone|iPad|Macintosh/.test(ua) ? "apple" : /Android/.test(ua) ? "android" : "autre");
    setMobile(/iPhone|Android|Mobile/.test(ua));
    void relire();
    // De retour de l'app Calendrier : l'encart dit tout de suite si l'agenda a lu les séances.
    const auRetour = () => { if (document.visibilityState === "visible") void relire(); };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  /** Le lien du compte : celui qu'on a déjà, sinon demandé au serveur (qui rend l'existant s'il y en a un). */
  async function obtenir(remplacer = false): Promise<Liens | null> {
    if (etat.k === "pret" && etat.liens && !remplacer) return etat.liens;
    generation.current++;
    setOccupe(true);
    try {
      const r = await fetch("/api/calendrier/abonnement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remplacer }) });
      const j = await r.json();
      if (j.indisponible) { setEtat({ k: "indisponible" }); return null; }
      // Un lien existe que le serveur ne sait pas retrouver : il ne l'écrase pas sans accord (voir `ajouter`).
      if (j.ancien) { setEtat({ k: "pret", actif: true, derniereLecture: null, liens: null }); toast(t("ancien")); return null; }
      if (!r.ok || !j.liens) { toast.error(t("erreur")); return null; }
      setEtat({ k: "pret", actif: true, derniereLecture: remplacer ? null : (etat.k === "pret" ? etat.derniereLecture : null), liens: j.liens, rappel: remplacer });
      return j.liens as Liens;
    } catch { toast.error(t("erreur")); return null; }
    finally { setOccupe(false); }
  }

  /**
   * Lien déjà connu : le navigateur suit le lien lui-même. Sinon on le crée, puis on y va. Lien
   * ancien (impossible à retrouver) : on ne le remplace qu'après confirmation, et on dit de
   * supprimer l'ancien calendrier, resté mort dans l'agenda.
   */
  async function ajouter(cible: Cible) {
    if (occupe || etat.k !== "pret") return;
    const ancien = etat.actif && !etat.liens;
    if (ancien && !window.confirm(t("confirmeAncien"))) return;
    setEnCours(cible);
    const liens = await obtenir(ancien);
    setEnCours(null);
    // Lien remplacé : on reste ici, le rappel (supprimer l'ancien calendrier) à l'écran ; le bouton,
    // devenu un vrai lien, ajoute le nouveau au prochain appui.
    if (!liens || ancien) return;
    window.location.assign(liens[cible]);
  }

  async function copier() {
    // Jamais de lien créé ou remplacé en douce depuis ce petit lien : en état « ancien », il est masqué.
    if (etat.k === "pret" && etat.actif && !etat.liens) return;
    const liens = await obtenir();
    if (!liens) return;
    try { await navigator.clipboard.writeText(liens.https); toast.success(t("copie")); }
    catch { window.prompt(t("copier"), liens.https); }
  }

  async function changer() {
    if (!window.confirm(t("confirmeChanger"))) return;
    await obtenir(true);
  }

  async function arreter() {
    if (!window.confirm(t("confirmeArret"))) return;
    generation.current++;
    setOccupe(true);
    try {
      const r = await fetch("/api/calendrier/abonnement", { method: "DELETE" });
      if (!r.ok) { toast.error(t("erreur")); return; }
      toast.success(t("arrete"));
      setEtat({ k: "pret", actif: false, derniereLecture: null, liens: null, rappel: false });
    } catch { toast.error(t("erreur")); }
    finally { setOccupe(false); }
  }

  const liens = etat.k === "pret" ? etat.liens : null;
  const LIBELLE: Record<Exclude<Cible, "outlookPro">, [string, string]> = {
    webcal: ["apple", "appleSous"], google: ["google", "googleSous"], outlook: ["outlookBouton", "outlookSous"],
  };
  // Les trois gros boutons marchent de la même façon : lien connu → un vrai lien ; sinon on le crée, puis on y va.
  const bouton = (cible: Exclude<Cible, "outlookPro">, premier: boolean) => {
    const style = `${gros} ${premier ? "bg-zinc-900 text-white hover:bg-zinc-800" : "border border-zinc-200 text-zinc-800 hover:bg-zinc-50"}`;
    const [titre, sous] = LIBELLE[cible];
    const contenu = (
      <>
        {enCours === cible ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <CalendarPlus className="h-5 w-5 shrink-0" />}
        <span>
          <span className="block text-sm font-semibold">{t(titre)}</span>
          <span className={`block text-xs ${premier ? "text-zinc-300" : "text-zinc-500"}`}>{t(sous)}</span>
        </span>
      </>
    );
    return liens
      ? <a key={cible} href={liens[cible]} aria-disabled={occupe} className={`${style} aria-disabled:pointer-events-none aria-disabled:opacity-40`}>{contenu}</a>
      : <button key={cible} type="button" onClick={() => ajouter(cible)} disabled={occupe} className={style}>{contenu}</button>;
  };

  return (
    <section ref={section} className="scroll-mt-20 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">{t("titre")}</h2>
      <p className="mt-0.5 text-sm text-zinc-500">{t("desc")}</p>
      <div className="mt-4 space-y-3">
        {depuisLien && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">{t("depuisLien")}</p>}
        {etat.k === "lecture" && <Loader2 role="status" aria-label="…" className="h-5 w-5 animate-spin text-zinc-400" />}
        {etat.k === "illisible" && <p className="text-sm text-zinc-500">{t("illisible")}</p>}
        {etat.k === "indisponible" && <p className="text-sm text-zinc-500">{t("indispo")}</p>}

        {etat.k === "pret" && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Apple : Apple, Google, Outlook. Ailleurs (Android, PC) : Google, Outlook, puis Apple, inutile sur un PC. */}
              {appleDabord ? [bouton("webcal", true), bouton("google", false), bouton("outlook", false)] : [bouton("google", true), bouton("outlook", false), bouton("webcal", false)]}
            </div>
            {/* Outlook d'un compte de travail ou d'école : même ajout en un clic, sur l'autre adresse de Microsoft. */}
            {!(etat.actif && !liens) && <p className="text-sm text-zinc-500">
              {t("pro")}{" "}
              {liens
                ? <a href={liens.outlookPro} aria-disabled={occupe} className={`${discret} text-zinc-700 hover:text-zinc-900 aria-disabled:pointer-events-none`}>{t("proLien")}</a>
                : <button type="button" onClick={() => ajouter("outlookPro")} disabled={occupe} className={`${discret} text-zinc-700 hover:text-zinc-900`}>{t("proLien")}</button>}
            </p>}
            {/* Téléphone : Outlook n'y ajoute pas de calendrier par lien ; la parade, visible (pas repliée). */}
            {mobile && <p className="text-sm text-zinc-600">{t("outlookTel")}</p>}
            {/* Android : Google n'offre pas toujours l'ajout dans le navigateur du téléphone ; la parade, visible. */}
            {appareil === "android" && <p className="text-sm text-zinc-600">{t("googleOrdi")}</p>}
            {etat.rappel && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">{t("rappel")}</p>}

            {etat.actif && liens && (
              etat.derniereLecture
                ? <p role="status" className="flex items-start gap-1.5 text-sm text-emerald-700"><Check className="mt-0.5 h-4 w-4 shrink-0" /> {t("relie", date(etat.derniereLecture))}</p>
                : <p className="text-sm text-zinc-600">{t("attente")}</p>
            )}
            {etat.actif && !liens && <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 ring-1 ring-amber-100">{t("ancien")}</p>}

            {!(etat.actif && !liens) && <p className="text-sm text-zinc-500">
              {t("autres")}{" "}
              <button onClick={copier} disabled={occupe} className={`inline-flex items-center gap-1 ${discret} text-zinc-700 hover:text-zinc-900`}><Copy className="h-3 w-3" /> {t("copier")}</button>
            </p>}

            <details className="group rounded-xl border border-zinc-100 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
                {t("aide")} <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="list-disc space-y-1.5 pb-3 pl-7 pr-3 text-sm text-zinc-600">
                <li>{t("delai")}</li>
                {appareil !== "autre" && <li>{t("googleTel")}</li>}
                {appareil === "apple" && <li>{t("iphone")}</li>}
                {appareil === "autre" && <li>{t("ordiConfirme")}</li>}
                <li>{t("outlookConnexion")}</li>
                <li>{t("outlookAppli")}</li>
              </ul>
            </details>

            <p className="text-xs text-zinc-500">{t("contenu")}</p>

            {etat.actif && (
              <p className="flex gap-5 text-sm">
                <button onClick={changer} disabled={occupe} className={`py-2 ${discret} text-zinc-700 hover:text-zinc-900`}>{t("changer")}</button>
                <button onClick={arreter} disabled={occupe} className={`py-2 ${discret} text-red-700 hover:text-red-800`}>{t("arreter")}</button>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  AJOUTER DES AMIS — l'annuaire social, façon Strava (Cyprien, 22/09/2026).
//
//  Trois portes, trois onglets : SUGGESTIONS (recherche par nom), CONTACTS (le carnet
//  du téléphone, apparié par adresse), QR CODE (montrer son code, scanner celui d'un
//  ami). Une barre de recherche au-dessus, qui prend la main dès qu'on y tape.
//
//  ⚠️ CE QUE LE NAVIGATEUR NE SAIT PAS FAIRE, ON LE DIT. Le sélecteur de contacts
//  n'existe que sur Chrome Android ; la lecture de QR code en direct (BarcodeDetector)
//  pareil. Sur iPhone — le téléphone de Cyprien — l'onglet Contacts propose d'inviter
//  par message et l'onglet QR code explique qu'on scanne avec l'appareil photo. Un
//  bouton qui ne ferait rien serait pire qu'une phrase honnête.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import qrcode from "qrcode-generator";
import { toast } from "sonner";
import { Search, UserPlus, UserCheck, Users, BookUser, QrCode, Share2, ScanLine, X, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { estUuid, idDepuisLien, lienAmi } from "@/lib/social/amisLiens";

export type Athlete = { id: string; full_name?: string | null; avatar_url?: string | null; league?: string | null; discipline_score?: number | null; following: boolean };

/** Clé locale où la page publique /amis/<id> dépose l'intention de suivre avant la connexion. */
export const CLE_SUIVRE = "pacevo.suivre";

const T: Record<string, Record<string, string>> = {
  fr: {
    suggestions: "Suggestions", contacts: "Contacts", qr: "QR code", resultats: "Résultats",
    inviteTitre: "Invite des amis qui ne sont pas sur Pacevo", inviter: "Inviter",
    inviteTexte: "Rejoins-moi sur Pacevo, le coach running qui adapte ton plan chaque jour.",
    lienCopie: "Lien copié", partageEchec: "Partage impossible",
    contactsChoisir: "Choisir dans mes contacts",
    contactsExplique: "Pacevo compare les adresses e-mail des contacts que tu choisis avec les comptes existants. Aucune adresse n'est conservée.",
    contactsIndispo: "Ton navigateur ne donne pas accès aux contacts du téléphone (c'est le cas sur iPhone). Invite tes amis par message : une fois inscrits, tu les retrouves dans Suggestions.",
    contactsBilan: "{n} contacts choisis · {m} déjà sur Pacevo", contactsAucun: "Aucun de ces contacts n'a encore de compte Pacevo.",
    contactsEchec: "Lecture des contacts impossible",
    qrExplique: "Fais scanner ce code par un ami avec l'appareil photo de son téléphone : il arrive directement sur ton invitation.",
    qrPartager: "Partager mon lien", qrScanner: "Scanner un code",
    qrScanIndispo: "Pour scanner le code d'un ami, ouvre l'appareil photo de ton téléphone et vise son code.",
    qrCamEchec: "Caméra inaccessible", qrPasPacevo: "Ce code n'est pas un code Pacevo", fermer: "Fermer",
    suivreCarte: "Suivre {nom} ?", introuvable: "Athlète introuvable",
  },
  en: {
    suggestions: "Suggestions", contacts: "Contacts", qr: "QR code", resultats: "Results",
    inviteTitre: "Invite friends who aren't on Pacevo yet", inviter: "Invite",
    inviteTexte: "Join me on Pacevo, the running coach that adapts your plan every day.",
    lienCopie: "Link copied", partageEchec: "Sharing failed",
    contactsChoisir: "Pick from my contacts",
    contactsExplique: "Pacevo matches the email addresses of the contacts you pick against existing accounts. No address is stored.",
    contactsIndispo: "Your browser doesn't give access to the phone's contacts (that's the case on iPhone). Invite your friends by message: once signed up, you'll find them under Suggestions.",
    contactsBilan: "{n} contacts picked · {m} already on Pacevo", contactsAucun: "None of these contacts has a Pacevo account yet.",
    contactsEchec: "Couldn't read contacts",
    qrExplique: "Have a friend scan this code with their phone camera: they land straight on your invitation.",
    qrPartager: "Share my link", qrScanner: "Scan a code",
    qrScanIndispo: "To scan a friend's code, open your phone camera and point it at their code.",
    qrCamEchec: "Camera unavailable", qrPasPacevo: "This isn't a Pacevo code", fermer: "Close",
    suivreCarte: "Follow {nom}?", introuvable: "Athlete not found",
  },
  de: {
    suggestions: "Vorschläge", contacts: "Kontakte", qr: "QR-Code", resultats: "Ergebnisse",
    inviteTitre: "Lade Freunde ein, die noch nicht bei Pacevo sind", inviter: "Einladen",
    inviteTexte: "Komm zu mir auf Pacevo, den Lauf-Coach, der deinen Plan jeden Tag anpasst.",
    lienCopie: "Link kopiert", partageEchec: "Teilen nicht möglich",
    contactsChoisir: "Aus meinen Kontakten wählen",
    contactsExplique: "Pacevo gleicht die E-Mail-Adressen der gewählten Kontakte mit bestehenden Konten ab. Keine Adresse wird gespeichert.",
    contactsIndispo: "Dein Browser gibt keinen Zugriff auf die Kontakte des Telefons (so ist es auf dem iPhone). Lade deine Freunde per Nachricht ein: nach der Anmeldung findest du sie unter Vorschläge.",
    contactsBilan: "{n} Kontakte gewählt · {m} bereits bei Pacevo", contactsAucun: "Keiner dieser Kontakte hat bisher ein Pacevo-Konto.",
    contactsEchec: "Kontakte konnten nicht gelesen werden",
    qrExplique: "Lass einen Freund diesen Code mit der Kamera seines Telefons scannen: er landet direkt auf deiner Einladung.",
    qrPartager: "Meinen Link teilen", qrScanner: "Code scannen",
    qrScanIndispo: "Um den Code eines Freundes zu scannen, öffne die Kamera deines Telefons und richte sie auf seinen Code.",
    qrCamEchec: "Kamera nicht verfügbar", qrPasPacevo: "Das ist kein Pacevo-Code", fermer: "Schließen",
    suivreCarte: "{nom} folgen?", introuvable: "Athlet nicht gefunden",
  },
  es: {
    suggestions: "Sugerencias", contacts: "Contactos", qr: "Código QR", resultats: "Resultados",
    inviteTitre: "Invita a amigos que aún no están en Pacevo", inviter: "Invitar",
    inviteTexte: "Únete a mí en Pacevo, el coach de running que adapta tu plan cada día.",
    lienCopie: "Enlace copiado", partageEchec: "No se pudo compartir",
    contactsChoisir: "Elegir entre mis contactos",
    contactsExplique: "Pacevo compara las direcciones de correo de los contactos que eliges con las cuentas existentes. No se guarda ninguna dirección.",
    contactsIndispo: "Tu navegador no da acceso a los contactos del teléfono (es el caso en iPhone). Invita a tus amigos por mensaje: una vez registrados, los encontrarás en Sugerencias.",
    contactsBilan: "{n} contactos elegidos · {m} ya en Pacevo", contactsAucun: "Ninguno de estos contactos tiene todavía cuenta en Pacevo.",
    contactsEchec: "No se pudieron leer los contactos",
    qrExplique: "Haz que un amigo escanee este código con la cámara de su teléfono: llegará directamente a tu invitación.",
    qrPartager: "Compartir mi enlace", qrScanner: "Escanear un código",
    qrScanIndispo: "Para escanear el código de un amigo, abre la cámara de tu teléfono y apunta a su código.",
    qrCamEchec: "Cámara no disponible", qrPasPacevo: "Este no es un código Pacevo", fermer: "Cerrar",
    suivreCarte: "¿Seguir a {nom}?", introuvable: "Atleta no encontrado",
  },
  pt: {
    suggestions: "Sugestões", contacts: "Contactos", qr: "Código QR", resultats: "Resultados",
    inviteTitre: "Convida amigos que ainda não estão na Pacevo", inviter: "Convidar",
    inviteTexte: "Junta-te a mim na Pacevo, o coach de corrida que adapta o teu plano todos os dias.",
    lienCopie: "Ligação copiada", partageEchec: "Não foi possível partilhar",
    contactsChoisir: "Escolher nos meus contactos",
    contactsExplique: "A Pacevo compara os e-mails dos contactos que escolhes com as contas existentes. Nenhum endereço é guardado.",
    contactsIndispo: "O teu navegador não dá acesso aos contactos do telemóvel (é o caso no iPhone). Convida os teus amigos por mensagem: depois de inscritos, encontra-los em Sugestões.",
    contactsBilan: "{n} contactos escolhidos · {m} já na Pacevo", contactsAucun: "Nenhum destes contactos tem ainda conta na Pacevo.",
    contactsEchec: "Não foi possível ler os contactos",
    qrExplique: "Pede a um amigo para ler este código com a câmara do telemóvel: chega diretamente ao teu convite.",
    qrPartager: "Partilhar a minha ligação", qrScanner: "Ler um código",
    qrScanIndispo: "Para ler o código de um amigo, abre a câmara do telemóvel e aponta para o código dele.",
    qrCamEchec: "Câmara indisponível", qrPasPacevo: "Este não é um código Pacevo", fermer: "Fechar",
    suivreCarte: "Seguir {nom}?", introuvable: "Atleta não encontrado",
  },
};

const initials = (name?: string | null) =>
  (name ?? "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

function Avatar({ a, size = 40 }: { a: { full_name?: string | null; avatar_url?: string | null }; size?: number }) {
  const s = { width: size, height: size };
  if (a.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.avatar_url} alt="" style={s} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <div style={s} className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
      {initials(a.full_name)}
    </div>
  );
}

// Le navigateur : sélecteur de contacts et lecteur de codes-barres n'ont pas de types DOM.
type ContactChoisi = { email?: string[]; name?: string[] };
type NavigateurContacts = Navigator & { contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<ContactChoisi[]> } };
type Detecteur = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type FenetreDetecteur = Window & { BarcodeDetector?: new (opts?: { formats?: string[] }) => Detecteur };

const peutChoisirContacts = () => typeof navigator !== "undefined" && !!(navigator as NavigateurContacts).contacts?.select;
const peutScanner = () => typeof window !== "undefined" && !!(window as FenetreDetecteur).BarcodeDetector && !!navigator.mediaDevices?.getUserMedia;

export function AjouterAmis({ moi, suivre, onFollowChange }: {
  moi: { id: string; nom: string | null };
  /** L'athlète d'un lien scanné (`?suivre=`), à proposer en tête. */
  suivre: string | null;
  onFollowChange: () => void;
}) {
  const { t, lang } = useT();
  const d = T[lang] ?? T.fr;
  const dd = (k: string, p?: Record<string, string | number>) => Object.entries(p ?? {}).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), d[k] ?? k);
  const router = useRouter();
  const [onglet, setOnglet] = useState<"suggestions" | "contacts" | "qr">("suggestions");
  const [q, setQ] = useState("");
  const [athletes, setAthletes] = useState<Athlete[] | null>(null);
  const [invite, setInvite] = useState<Athlete | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      const r = await fetch(`/api/social/follow?q=${encodeURIComponent(query)}`);
      const j = await r.json();
      setAthletes(j.athletes ?? []);
    } catch { setAthletes([]); }
  }, []);

  // Recherche différée : sans ce délai, chaque frappe déclenchait une requête.
  useEffect(() => {
    const id = setTimeout(() => void load(q), q ? 300 : 0);
    return () => clearTimeout(id);
  }, [q, load]);

  // L'intention « suivre X » : portée par l'adresse (?suivre=, après un scan) ou déposée
  // en local par la page publique /amis/<id> avant la connexion. Consommée UNE fois.
  useEffect(() => {
    let id: string | null = suivre;
    if (!id) { try { id = localStorage.getItem(CLE_SUIVRE); } catch { id = null; } }
    try { localStorage.removeItem(CLE_SUIVRE); } catch { /* stockage indisponible */ }
    if (!estUuid(id) || id === moi.id) return;
    let vivant = true;
    (async () => {
      try {
        const r = await fetch(`/api/social/follow?id=${id}`);
        const j = await r.json();
        if (!vivant) return;
        if (r.ok && j.athlete) setInvite(j.athlete);
        else toast.error(d.introuvable);
      } catch { if (vivant) toast.error(d.introuvable); }
      if (suivre) router.replace("/dashboard/communaute");
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivre, moi.id]);

  /** Suivre / ne plus suivre, avec retour arrière si le serveur refuse. */
  async function toggle(a: Athlete, applique: (f: (x: Athlete) => Athlete) => void) {
    applique((x) => x.id === a.id ? { ...x, following: !x.following } : x);
    const r = await fetch("/api/social/follow", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: a.id }),
    });
    if (!r.ok) {
      applique((x) => x.id === a.id ? { ...x, following: a.following } : x);
      const j = await r.json().catch(() => ({}));
      toast.error(j.error || t("club.err.publish"));
      return;
    }
    onFollowChange();
  }
  const toggleListe = (a: Athlete) => toggle(a, (f) => setAthletes((prev) => prev?.map(f) ?? null));
  const toggleInvite = (a: Athlete) => toggle(a, (f) => setInvite((prev) => (prev ? f(prev) : prev)));

  async function inviter() {
    const url = typeof window === "undefined" ? "" : window.location.origin;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    try {
      if (nav.share) { await nav.share({ title: "Pacevo", text: d.inviteTexte, url }); return; }
      await navigator.clipboard.writeText(`${d.inviteTexte} ${url}`);
      toast.success(d.lienCopie);
    } catch (e) {
      // L'annulation par l'athlète n'est pas une erreur.
      if ((e as { name?: string })?.name !== "AbortError") toast.error(d.partageEchec);
    }
  }

  const Ligne = ({ a, onToggle }: { a: Athlete; onToggle: (a: Athlete) => void }) => (
    <div className="flex items-center gap-3 py-2.5">
      <Avatar a={a} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-zinc-900">{a.full_name || t("club.athlete")}</div>
        {/* On n'affiche la ligue et le score QUE s'ils existent : un « Ligue —, score 0 »
            ferait passer un compte neuf pour un compte à l'abandon. */}
        {(a.league || (a.discipline_score ?? 0) > 0) && (
          <div className="truncate text-xs text-zinc-500">
            {[a.league, (a.discipline_score ?? 0) > 0 ? t("club.discipline", { n: a.discipline_score ?? 0 }) : null].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      <button type="button" onClick={() => onToggle(a)}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
          a.following ? "border border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
        {a.following ? <><UserCheck className="h-3.5 w-3.5" /> {t("club.following")}</> : <><UserPlus className="h-3.5 w-3.5" /> {t("club.follow")}</>}
      </button>
    </div>
  );

  const Invitation = () => (
    <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-center">
      <p className="text-sm font-semibold text-zinc-800">{d.inviteTitre}</p>
      <button type="button" onClick={inviter} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:mx-auto sm:w-auto sm:px-6">
        <Share2 className="h-4 w-4" />{d.inviter}
      </button>
    </div>
  );

  const ONGLETS = [
    { k: "suggestions" as const, l: d.suggestions, I: Users },
    { k: "contacts" as const, l: d.contacts, I: BookUser },
    { k: "qr" as const, l: d.qr, I: QrCode },
  ];

  return (
    <div>
      {/* L'athlète d'un code scanné, en tête : c'est pour lui qu'on a ouvert la page. */}
      {invite && (
        <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2">
          <p className="pt-1 text-xs font-bold uppercase tracking-wide text-emerald-700">{dd("suivreCarte", { nom: invite.full_name || t("club.athlete") })}</p>
          <Ligne a={invite} onToggle={toggleInvite} />
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("club.searchPh")} aria-label={t("club.searchPh")}
          className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-9 text-[15px] outline-none focus:border-emerald-400 focus:bg-white" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={d.fermer} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {q ? (
        /* La recherche prend la main sur l'onglet, quel qu'il soit. */
        <div className="mt-3">
          <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{d.resultats}</p>
          {athletes === null ? <Squelette /> : athletes.length === 0
            ? <p className="py-8 text-center text-sm text-zinc-400">{t("club.noMatch", { q })}</p>
            : <div className="divide-y divide-zinc-100">{athletes.map((a) => <Ligne key={a.id} a={a} onToggle={toggleListe} />)}</div>}
        </div>
      ) : (
        <>
          {/* Trois onglets à icône, soulignés — la rangée de Strava. */}
          <div role="tablist" className="mt-3 grid grid-cols-3 border-b border-zinc-200">
            {ONGLETS.map(({ k, l, I }) => (
              <button key={k} role="tab" type="button" aria-selected={onglet === k} onClick={() => setOnglet(k)}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${onglet === k ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}>
                <I className="h-5 w-5" strokeWidth={onglet === k ? 2.25 : 2} />
                {l}
                {onglet === k && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-emerald-600" />}
              </button>
            ))}
          </div>

          {onglet === "suggestions" && (
            <div className="mt-3">
              {athletes === null ? <Squelette /> : athletes.length === 0
                ? <p className="py-8 text-center text-sm text-zinc-400">{t("club.noSuggestion")}</p>
                : <>
                    <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("club.suggestions")}</p>
                    <div className="divide-y divide-zinc-100">{athletes.map((a) => <Ligne key={a.id} a={a} onToggle={toggleListe} />)}</div>
                  </>}
              <Invitation />
            </div>
          )}

          {onglet === "contacts" && <Contacts d={d} dd={dd} Ligne={Ligne} Invitation={Invitation} />}

          {onglet === "qr" && <CodeQr moi={moi} d={d} onScan={(id) => router.push(`/dashboard/communaute?suivre=${id}`)} />}
        </>
      )}
    </div>
  );
}

const Squelette = () => <div className="space-y-2 pt-1">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100" />)}</div>;

/** L'onglet Contacts : le sélecteur du navigateur quand il existe, l'invitation sinon. */
function Contacts({ d, dd, Ligne, Invitation }: {
  d: Record<string, string>; dd: (k: string, p?: Record<string, string | number>) => string;
  Ligne: (p: { a: Athlete; onToggle: (a: Athlete) => void }) => React.JSX.Element; Invitation: () => React.JSX.Element;
}) {
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [chargement, setChargement] = useState(false);
  const [bilan, setBilan] = useState<{ soumis: number; athletes: Athlete[] } | null>(null);
  // Décidé APRÈS le montage : au rendu serveur, `navigator` n'existe pas.
  useEffect(() => { setDispo(peutChoisirContacts()); }, []);

  async function choisir() {
    setChargement(true);
    try {
      const choisis = await (navigator as NavigateurContacts).contacts!.select(["email", "name"], { multiple: true });
      const emails = choisis.flatMap((c) => c.email ?? []);
      const r = await fetch("/api/social/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setBilan({ soumis: choisis.length, athletes: j.athletes ?? [] });
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") toast.error(d.contactsEchec);
    }
    setChargement(false);
  }
  const toggle = async (a: Athlete) => {
    setBilan((b) => b && { ...b, athletes: b.athletes.map((x) => x.id === a.id ? { ...x, following: !x.following } : x) });
    const r = await fetch("/api/social/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ athleteId: a.id }) });
    if (!r.ok) setBilan((b) => b && { ...b, athletes: b.athletes.map((x) => x.id === a.id ? { ...x, following: a.following } : x) });
  };

  if (dispo === null) return <Squelette />;
  if (!dispo) {
    return (
      <div className="mt-3">
        <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-600">{d.contactsIndispo}</p>
        <Invitation />
      </div>
    );
  }
  return (
    <div className="mt-3">
      <button type="button" onClick={choisir} disabled={chargement}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
        {chargement ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookUser className="h-4 w-4" />}{d.contactsChoisir}
      </button>
      <p className="mt-2 px-1 text-xs leading-relaxed text-zinc-500">{d.contactsExplique}</p>
      {bilan && (
        <div className="mt-4">
          <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{dd("contactsBilan", { n: bilan.soumis, m: bilan.athletes.length })}</p>
          {bilan.athletes.length === 0
            ? <p className="py-6 text-center text-sm text-zinc-400">{d.contactsAucun}</p>
            : <div className="divide-y divide-zinc-100">{bilan.athletes.map((a) => <Ligne key={a.id} a={a} onToggle={toggle} />)}</div>}
        </div>
      )}
      <Invitation />
    </div>
  );
}

/** L'onglet QR code : mon code (à faire scanner) et, quand le navigateur sait lire, un scanner. */
function CodeQr({ moi, d, onScan }: { moi: { id: string; nom: string | null }; d: Record<string, string>; onScan: (id: string) => void }) {
  const [origine, setOrigine] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  useEffect(() => { setOrigine(window.location.origin); }, []);
  const lien = origine ? lienAmi(origine, moi.id) : null;

  async function partager() {
    if (!lien) return;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    try {
      if (nav.share) { await nav.share({ title: "Pacevo", text: d.inviteTexte, url: lien }); return; }
      await navigator.clipboard.writeText(lien);
      toast.success(d.lienCopie);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") toast.error(d.partageEchec);
    }
  }

  return (
    <div className="mt-4">
      <div className="mx-auto max-w-xs rounded-3xl border border-zinc-100 bg-white p-5 text-center shadow-sm">
        {lien ? <QrSvg texte={lien} /> : <div className="mx-auto h-48 w-48 animate-pulse rounded-xl bg-zinc-100" />}
        <p className="mt-3 text-base font-bold text-zinc-900">{moi.nom || "Pacevo"}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{d.qrExplique}</p>
      </div>
      <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2">
        <button type="button" onClick={partager} className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
          <Share2 className="h-4 w-4" />{d.qrPartager}
        </button>
        {origine !== null && (peutScanner()
          ? <button type="button" onClick={() => setScan(true)} className="flex items-center justify-center gap-2 rounded-full border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300">
              <ScanLine className="h-4 w-4" />{d.qrScanner}
            </button>
          : <p className="px-2 text-center text-xs leading-relaxed text-zinc-500">{d.qrScanIndispo}</p>)}
      </div>
      {scan && origine && <Scanner origine={origine} d={d} onFermer={() => setScan(false)} onTrouve={(id) => { setScan(false); onScan(id); }} />}
    </div>
  );
}

/**
 * Le QR code, rendu en <rect> React — pas en HTML injecté. Le contenu est un lien que
 * NOUS composons ; le rendre module par module ferme quand même la porte à toute
 * injection le jour où ce composant recevrait un texte venu d'ailleurs.
 */
function QrSvg({ texte }: { texte: string }) {
  const qr = qrcode(0, "M");
  qr.addData(texte);
  qr.make();
  const n = qr.getModuleCount();
  const cases: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cases.push(`M${c} ${r}h1v1h-1z`);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="mx-auto h-48 w-48" shapeRendering="crispEdges" role="img" aria-label={texte}>
      <path d={cases.join("")} fill="#18181b" />
    </svg>
  );
}

/** Lecture en direct par la caméra — uniquement là où `BarcodeDetector` existe. */
function Scanner({ origine, d, onFermer, onTrouve }: { origine: string; d: Record<string, string>; onFermer: () => void; onTrouve: (id: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let flux: MediaStream | null = null;
    let minuterie: ReturnType<typeof setInterval> | null = null;
    let fini = false;
    const arreter = () => { if (minuterie) clearInterval(minuterie); flux?.getTracks().forEach((t) => t.stop()); };
    (async () => {
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (fini || !video.current) { flux.getTracks().forEach((t) => t.stop()); return; }
        video.current.srcObject = flux;
        await video.current.play();
        const detecteur = new (window as FenetreDetecteur).BarcodeDetector!({ formats: ["qr_code"] });
        let avertit = false;
        minuterie = setInterval(async () => {
          if (!video.current || fini) return;
          try {
            const codes = await detecteur.detect(video.current);
            for (const c of codes) {
              const id = idDepuisLien(c.rawValue, origine);
              if (id) { fini = true; arreter(); onTrouve(id); return; }
              if (!avertit) { avertit = true; toast.info(d.qrPasPacevo); }
            }
          } catch { /* une image non décodable : on réessaie au tour suivant */ }
        }, 300);
      } catch {
        toast.error(d.qrCamEchec);
        onFermer();
      }
    })();
    return () => { fini = true; arreter(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <video ref={video} className="h-full w-full object-cover" muted playsInline />
      <button type="button" onClick={onFermer} aria-label={d.fermer} className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-zinc-900" style={{ top: "calc(1rem + env(safe-area-inset-top))" }}>
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

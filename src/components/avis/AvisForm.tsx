"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Loader2, Check } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
// ⚠️ `lib/avis/bornes`, PAS `lib/avis/store` : le store importe le filtre de
// grossièretés, et l'importer ici enverrait ses 106 racines dans le bundle public.
import { TEXTE_MIN, TEXTE_MAX } from "@/lib/avis/bornes";

/**
 * ÉCRIRE SON AVIS — réservé aux comptes existants.
 *
 * La page publique promet « n'afficher que des avis de personnes ayant réellement un
 * compte ». Ce formulaire est ce qui rend la promesse vérifiable : l'API refuse toute
 * soumission non authentifiée, et l'auteur affiché est calculé depuis le profil, jamais
 * envoyé par le navigateur.
 *
 * ⚠️ On n'appelle PAS l'API au montage pour savoir si la personne est connectée — un 401
 * sur chaque visite anonyme de la page d'avis, c'est du bruit pour rien. Le composant
 * demande une fois, et bascule sur l'invitation à se connecter si la réponse est 401.
 */
const T: Record<string, Record<string, string>> = {
  fr: { titre: "Écris ton avis", sousTitre: "Il sera publié tel quel, sous ton prénom et l'initiale de ton nom.", note: "Ta note", texte: "Ton avis", place: "Ce qui t'a servi, ce qui t'a manqué…", envoyer: "Publier mon avis", envoi: "Envoi…", merci: "Merci. Ton avis est enregistré — il apparaîtra ici après une relecture contre les insultes et le spam. Ta note n'entre pas en compte dans cette relecture.", modifier: "Modifier mon avis", connecte: "Il faut un compte pour écrire un avis — c'est la garantie qu'ils viennent tous de vraies personnes.", seConnecter: "Se connecter", creer: "Créer un compte gratuit", court: "Encore {n} caractères", erreur: "Une erreur est survenue.", reseau: "Connexion impossible. Réessaie." },
  en: { titre: "Write your review", sousTitre: "It will be published as written, under your first name and last initial.", note: "Your rating", texte: "Your review", place: "What helped, what was missing…", envoyer: "Publish my review", envoi: "Sending…", merci: "Thank you. Your review is saved — it will appear here after a check against abuse and spam. Your rating plays no part in that check.", modifier: "Edit my review", connecte: "You need an account to write a review — that is what guarantees they all come from real people.", seConnecter: "Sign in", creer: "Create a free account", court: "{n} more characters", erreur: "Something went wrong.", reseau: "Connection failed. Try again." },
  de: { titre: "Schreib deine Bewertung", sousTitre: "Sie wird unverändert veröffentlicht, mit Vorname und Initiale.", note: "Deine Bewertung", texte: "Dein Text", place: "Was geholfen hat, was gefehlt hat…", envoyer: "Bewertung veröffentlichen", envoi: "Senden…", merci: "Danke. Deine Bewertung ist gespeichert — sie erscheint nach einer Prüfung auf Beleidigungen und Spam. Deine Note spielt dabei keine Rolle.", modifier: "Bewertung bearbeiten", connecte: "Für eine Bewertung brauchst du ein Konto — so ist sichergestellt, dass alle von echten Menschen stammen.", seConnecter: "Anmelden", creer: "Kostenloses Konto erstellen", court: "Noch {n} Zeichen", erreur: "Ein Fehler ist aufgetreten.", reseau: "Keine Verbindung. Versuch es erneut." },
  es: { titre: "Escribe tu opinión", sousTitre: "Se publicará tal cual, con tu nombre y la inicial del apellido.", note: "Tu nota", texte: "Tu opinión", place: "Lo que te sirvió, lo que faltó…", envoyer: "Publicar mi opinión", envoi: "Enviando…", merci: "Gracias. Tu opinión está guardada — aparecerá tras una revisión contra insultos y spam. Tu nota no cuenta en esa revisión.", modifier: "Editar mi opinión", connecte: "Necesitas una cuenta para opinar — así se garantiza que todas vienen de personas reales.", seConnecter: "Iniciar sesión", creer: "Crear cuenta gratis", court: "Faltan {n} caracteres", erreur: "Se ha producido un error.", reseau: "Sin conexión. Inténtalo de nuevo." },
  pt: { titre: "Escreve a tua avaliação", sousTitre: "Será publicada tal como escreves, com o teu nome e a inicial do apelido.", note: "A tua nota", texte: "A tua avaliação", place: "O que te ajudou, o que faltou…", envoyer: "Publicar a minha avaliação", envoi: "A enviar…", merci: "Obrigado. A tua avaliação ficou guardada — aparecerá após uma verificação contra insultos e spam. A tua nota não conta nessa verificação.", modifier: "Editar a minha avaliação", connecte: "Precisas de conta para avaliar — é isso que garante que todas vêm de pessoas reais.", seConnecter: "Entrar", creer: "Criar conta grátis", court: "Faltam {n} caracteres", erreur: "Ocorreu um erro.", reseau: "Sem ligação. Tenta de novo." },
};

// Libellé de la note (survolée ou choisie) — rend le choix vivant, pas un simple compteur d'étoiles.
const NOTES: Record<string, string[]> = {
  fr: ["Décevant", "Moyen", "Bien", "Très bien", "Excellent"],
  en: ["Poor", "Fair", "Good", "Very good", "Excellent"],
  de: ["Schwach", "Mittel", "Gut", "Sehr gut", "Ausgezeichnet"],
  es: ["Flojo", "Regular", "Bien", "Muy bien", "Excelente"],
  pt: ["Fraco", "Razoável", "Bom", "Muito bom", "Excelente"],
};

export function AvisForm() {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const notes = NOTES[lang] ?? NOTES.fr;
  const [etat, setEtat] = useState<"charge" | "anonyme" | "pret" | "envoi" | "merci">("charge");
  const [note, setNote] = useState(5);
  const [survol, setSurvol] = useState<number | null>(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/avis")
      .then(async (r) => {
        if (r.status === 401) return setEtat("anonyme");
        const j = await r.json();
        if (j?.avis) { setNote(j.avis.note); setTexte(j.avis.texte); }
        setEtat("pret");
      })
      .catch(() => setEtat("anonyme"));
  }, []);

  const manque = Math.max(0, TEXTE_MIN - texte.trim().length);

  async function envoyer() {
    setEtat("envoi"); setErreur(null);
    try {
      const r = await fetch("/api/avis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, texte }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErreur(j?.error ?? t.erreur); setEtat("pret"); return; }
      setEtat("merci");
    } catch { setErreur(t.reseau); setEtat("pret"); }
  }

  if (etat === "charge") return <div className="h-32" aria-hidden />;

  if (etat === "anonyme") {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center ring-1 ring-inset ring-zinc-200">
        <p className="text-sm leading-relaxed text-zinc-600">{t.connecte}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">{t.seConnecter}</Link>
          <Link href="/signup" className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50">{t.creer}</Link>
        </div>
      </div>
    );
  }

  if (etat === "merci") {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-emerald-50 p-8 text-center ring-1 ring-inset ring-emerald-200">
        <Check className="mx-auto h-6 w-6 text-emerald-600" />
        <p className="mt-3 text-sm leading-relaxed text-emerald-900">{t.merci}</p>
        <button onClick={() => setEtat("pret")} className="mt-5 text-sm font-semibold text-emerald-700 underline underline-offset-4">{t.modifier}</button>
      </div>
    );
  }

  const affichee = survol ?? note;
  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 ring-1 ring-inset ring-zinc-200 sm:p-8">
      {/* ⚠️ PLUS D'EN-TÊTE EN DÉGRADÉ ÉMERAUDE. Une bande colorée avec sa pastille d'icône
          par-dessus un corps blanc, c'est le gabarit qu'on voit sur tous les formulaires
          générés : ça décore au lieu de hiérarchiser. Un titre, une ligne d'explication,
          puis les champs — le regard va droit à ce qu'il doit remplir. */}
      <h3 className="text-lg font-bold tracking-tight text-zinc-900">{t.titre}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{t.sousTitre}</p>

      {/* ── LA NOTE ──────────────────────────────────────────────────────────────
          ⚠️ LES ÉTOILES ÉTAIENT CINQ GROSSES FORMES AMBRE POSÉES DANS LE VIDE, à 32 px,
          sans rien qui les désigne comme un champ à remplir. C'est ce qui faisait
          « débutant » : un contrôle doit se voir comme un contrôle.
          Elles vivent donc dans un cadre, à 24 px, et le libellé occupe une largeur
          MINIMALE FIXE — sinon passer de « Bien » à « Très bien » décalait la ligne à
          chaque survol, ce qui donnait cette impression de flottement. */}
      <div className="mt-6">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.note}</label>
        <div className="mt-2 inline-flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2 ring-1 ring-inset ring-zinc-200">
          <div className="flex items-center gap-0.5" onMouseLeave={() => setSurvol(null)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n} type="button" onClick={() => setNote(n)} onMouseEnter={() => setSurvol(n)}
                aria-label={`${n}/5`} aria-pressed={note === n}
                className="rounded-lg p-1 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-95"
              >
                <Star
                  className={`h-6 w-6 transition-colors duration-150 ${
                    n <= affichee ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="min-w-[5.5rem] text-sm font-semibold text-zinc-700">{notes[affichee - 1]}</span>
        </div>
      </div>

      {/* ── LE TEXTE ─────────────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <label htmlFor="avis-texte" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t.texte}</label>
        <textarea
          id="avis-texte"
          value={texte} onChange={(e) => setTexte(e.target.value.slice(0, TEXTE_MAX))}
          placeholder={t.place} rows={4}
          className="mt-2 w-full resize-none rounded-2xl border-0 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 ring-1 ring-inset ring-zinc-200 outline-none placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {erreur && <p className="mt-3 text-sm font-medium text-red-600">{erreur}</p>}

      {/* Le bouton et les compteurs sur UNE ligne : le compteur de caractères manquants
          explique pourquoi le bouton est encore gris, il doit donc être à côté de lui et
          pas trois lignes plus haut. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          onClick={envoyer} disabled={etat === "envoi" || manque > 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {etat === "envoi" && <Loader2 className="h-4 w-4 animate-spin" />}
          {etat === "envoi" ? t.envoi : t.envoyer}
        </button>
        {manque > 0 && <span className="text-xs text-zinc-400">{t.court.replace("{n}", String(manque))}</span>}
        <span className="ml-auto text-xs tabular-nums text-zinc-300">{texte.trim().length}/{TEXTE_MAX}</span>
      </div>
    </div>
  );
}

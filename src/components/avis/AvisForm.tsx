"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
 * UN SEUL appel à l'API au montage : il dit si la personne est connectée ET, si oui,
 * ramène son avis existant à modifier. Un visiteur anonyme reçoit un 401 — c'est la
 * réponse attendue, pas une erreur : le composant bascule alors sur l'invitation à se
 * connecter. (Une vérification côté serveur éviterait ce 401 en console, mais elle
 * ferait dépendre une page publique de la session : à ne faire que si ça gêne vraiment.)
 */
const T: Record<string, Record<string, string>> = {
  fr: { titre: "Écris ton avis", sousTitre: "Il sera publié tel quel, sous ton prénom et l'initiale de ton nom.", note: "Ta note", texte: "Ton avis", place: "Ce qui t'a servi, ce qui t'a manqué…", envoyer: "Publier mon avis", envoi: "Envoi…", merci: "Merci. Ton avis est en ligne, tel que tu l'as écrit.", modifier: "Modifier mon avis", connecte: "Il faut un compte pour écrire un avis — c'est la garantie qu'ils viennent tous de vraies personnes.", seConnecter: "Se connecter", creer: "Créer un compte gratuit", court: "Encore {n} caractères", erreur: "Une erreur est survenue.", reseau: "Connexion impossible. Réessaie." },
  en: { titre: "Write your review", sousTitre: "It will be published as written, under your first name and last initial.", note: "Your rating", texte: "Your review", place: "What helped, what was missing…", envoyer: "Publish my review", envoi: "Sending…", merci: "Thank you. Your review is live, exactly as you wrote it.", modifier: "Edit my review", connecte: "You need an account to write a review — that is what guarantees they all come from real people.", seConnecter: "Sign in", creer: "Create a free account", court: "{n} more characters", erreur: "Something went wrong.", reseau: "Connection failed. Try again." },
  de: { titre: "Schreib deine Bewertung", sousTitre: "Sie wird unverändert veröffentlicht, mit Vorname und Initiale.", note: "Deine Bewertung", texte: "Dein Text", place: "Was geholfen hat, was gefehlt hat…", envoyer: "Bewertung veröffentlichen", envoi: "Senden…", merci: "Danke. Deine Bewertung ist online, genau so, wie du sie geschrieben hast.", modifier: "Bewertung bearbeiten", connecte: "Für eine Bewertung brauchst du ein Konto — so ist sichergestellt, dass alle von echten Menschen stammen.", seConnecter: "Anmelden", creer: "Kostenloses Konto erstellen", court: "Noch {n} Zeichen", erreur: "Ein Fehler ist aufgetreten.", reseau: "Keine Verbindung. Versuch es erneut." },
  es: { titre: "Escribe tu opinión", sousTitre: "Se publicará tal cual, con tu nombre y la inicial del apellido.", note: "Tu nota", texte: "Tu opinión", place: "Lo que te sirvió, lo que faltó…", envoyer: "Publicar mi opinión", envoi: "Enviando…", merci: "Gracias. Tu opinión ya está publicada, tal y como la escribiste.", modifier: "Editar mi opinión", connecte: "Necesitas una cuenta para opinar — así se garantiza que todas vienen de personas reales.", seConnecter: "Iniciar sesión", creer: "Crear cuenta gratis", court: "Faltan {n} caracteres", erreur: "Se ha producido un error.", reseau: "Sin conexión. Inténtalo de nuevo." },
  pt: { titre: "Escreve a tua avaliação", sousTitre: "Será publicada tal como escreves, com o teu nome e a inicial do apelido.", note: "A tua nota", texte: "A tua avaliação", place: "O que te ajudou, o que faltou…", envoyer: "Publicar a minha avaliação", envoi: "A enviar…", merci: "Obrigado. A tua avaliação está online, tal como a escreveste.", modifier: "Editar a minha avaliação", connecte: "Precisas de conta para avaliar — é isso que garante que todas vêm de pessoas reais.", seConnecter: "Entrar", creer: "Criar conta grátis", court: "Faltam {n} caracteres", erreur: "Ocorreu um erro.", reseau: "Sem ligação. Tenta de novo." },
};

// Libellé de la note (survolée ou choisie) — rend le choix vivant, pas un simple compteur d'étoiles.
const NOTES: Record<string, string[]> = {
  fr: ["Décevant", "Moyen", "Bien", "Très bien", "Excellent"],
  en: ["Poor", "Fair", "Good", "Very good", "Excellent"],
  de: ["Schwach", "Mittel", "Gut", "Sehr gut", "Ausgezeichnet"],
  es: ["Flojo", "Regular", "Bien", "Muy bien", "Excelente"],
  pt: ["Fraco", "Razoável", "Bom", "Muito bom", "Excelente"],
};

/** Une seule enveloppe pour les trois états : la carte ne doit pas changer de forme
 *  entre « connecte-toi », « écris » et « merci ». */
const CARTE =
  "mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,.04),0_8px_24px_-12px_rgba(0,0,0,.10)] ring-1 ring-inset ring-zinc-200/80 sm:p-8";

export function AvisForm() {
  const { lang } = useT();
  const router = useRouter();
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
      // ⚠️ L'avis est publié dès l'écriture (le filtre de grossièretés a tourné AVANT
      // l'insertion, cf. /api/avis). La liste est rendue côté serveur : sans ce
      // rafraîchissement, « ton avis est en ligne » serait vrai en base et faux à
      // l'écran jusqu'au prochain rechargement. `refresh()` relit les composants
      // serveur sans toucher à l'état de ce formulaire.
      router.refresh();
    } catch { setErreur(t.reseau); setEtat("pret"); }
  }

  if (etat === "charge") return <div className="h-32" aria-hidden />;

  if (etat === "anonyme") {
    return (
      <div className={`${CARTE} text-center`}>
        <p className="text-[15px] leading-relaxed text-zinc-600">{t.connecte}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">{t.seConnecter}</Link>
          <Link href="/signup" className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50">{t.creer}</Link>
        </div>
      </div>
    );
  }

  if (etat === "merci") {
    return (
      <div className={`${CARTE} text-center`}>
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/10">
          <Check className="h-5 w-5 text-emerald-700" />
        </span>
        <p className="mt-4 text-[15px] leading-relaxed text-zinc-700">{t.merci}</p>
        <button onClick={() => setEtat("pret")} className="mt-5 text-sm font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:decoration-emerald-600">{t.modifier}</button>
      </div>
    );
  }

  const affichee = survol ?? note;
  return (
    <div className={CARTE}>
      <h3 className="text-xl font-bold tracking-tight text-zinc-900">{t.titre}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{t.sousTitre}</p>

      {/* ── LA NOTE ───────────────────────────────────────────────────────────────
          ⚠️ DEUX ERREURS CORRIGÉES ICI, DANS CET ORDRE.
          1. Les étoiles flottaient à 32 px dans le vide, sans rien les désigner comme un
             champ : illisible comme contrôle.
          2. Je les avais alors enfermées dans une pastille GRISE — qui les faisait
             paraître désactivées, donc pire. Un champ se signale par son LIBELLÉ et son
             affordance au survol, pas par un aplat gris.
          Libellés en `text-sm font-medium text-zinc-700` et non en 11 px gris clair :
          c'est ce micro-texte pâle en majuscules qui donnait l'air « gabarit ». */}
      <fieldset className="mt-7">
        <legend className="text-sm font-medium text-zinc-700">{t.note}</legend>
        <div className="mt-2.5 flex items-center gap-4">
          <div className="flex items-center gap-1" onMouseLeave={() => setSurvol(null)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n} type="button" onClick={() => setNote(n)} onMouseEnter={() => setSurvol(n)}
                aria-label={`${n}/5`} aria-pressed={note === n}
                className="rounded-lg p-0.5 outline-none transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-95"
              >
                <Star
                  className={`h-8 w-8 transition-colors duration-150 ${
                    n <= affichee ? "fill-amber-400 text-amber-400" : "fill-zinc-100 text-zinc-300"
                  }`}
                />
              </button>
            ))}
          </div>
          {/* Largeur minimale fixe : sans elle, « Bien » → « Très bien » décale la ligne
              à chaque survol, et la notation semble bouger sous le curseur. */}
          <span className="min-w-[6rem] text-sm font-semibold text-zinc-700">{notes[affichee - 1]}</span>
        </div>
      </fieldset>

      {/* ── LE TEXTE ──────────────────────────────────────────────────────────────
          Fond BLANC bordé, pas un aplat gris : un champ vide en gris se lit comme
          désactivé, et c'était le plus grand bloc de la carte. */}
      <div className="mt-7">
        <label htmlFor="avis-texte" className="block text-sm font-medium text-zinc-700">{t.texte}</label>
        <textarea
          id="avis-texte"
          value={texte} onChange={(e) => setTexte(e.target.value.slice(0, TEXTE_MAX))}
          placeholder={t.place} rows={4}
          className="mt-2.5 w-full resize-none rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-zinc-900 ring-1 ring-inset ring-zinc-300 outline-none transition placeholder:text-zinc-400 hover:ring-zinc-400 focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
          <span>{manque > 0 ? t.court.replace("{n}", String(manque)) : ""}</span>
          <span className="tabular-nums">{texte.trim().length}/{TEXTE_MAX}</span>
        </div>
      </div>

      {erreur && <p className="mt-3 text-sm font-medium text-red-600">{erreur}</p>}

      {/* ⚠️ LE BOUTON DÉSACTIVÉ RESTE ÉMERAUDE, JUSTE ATTÉNUÉ. En gris `zinc-200` il
          devenait le point focal de la carte ET semblait cassé : le visiteur lisait « ça
          ne marche pas » là où il faut lire « pas encore ». La couleur de marque conservée
          dit la bonne chose, et le compteur au-dessus explique ce qui manque. */}
      <button
        onClick={envoyer} disabled={etat === "envoi" || manque > 0}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {etat === "envoi" && <Loader2 className="h-4 w-4 animate-spin" />}
        {etat === "envoi" ? t.envoi : t.envoyer}
      </button>
    </div>
  );
}

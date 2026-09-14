/**
 * TEXTES DE LA LISTE D'ATTENTE (avant-lancement), dans les cinq langues publiées.
 *
 * Dictionnaire local (comme `pwaI18n`) pour ne pas alourdir le grand `landingI18n`. Les
 * chiffres de l'offre ({places}, {remise}) ne sont PAS écrits ici : ils viennent de
 * `OFFRE_FONDATEUR` et sont injectés par le composant — une seule source, jamais recopiée.
 */
export type WaitlistBloc = {
  eyebrow: string;
  title: string;
  subtitle: string;
  offer: string;      // contient {places} et {remise}
  b1: string;         // avantage 1
  b2: string;         // avantage 2 (contient {remise})
  b3: string;         // avantage 3
  note: string;
};

export const WAITLIST_I18N: Record<string, WaitlistBloc> = {
  fr: {
    eyebrow: "Avant-première",
    title: "Rejoins la liste — accès fondateur",
    subtitle: "Pacevo arrive. Laisse ton e-mail : tu seras prévenu·e en premier au lancement.",
    offer: "🎁 Offre fondateur : les {places} premiers inscrits obtiennent l'accès prioritaire et −{remise}% sur leur première année.",
    b1: "Accès prioritaire au lancement",
    b2: "−{remise}% la première année (100 premiers)",
    b3: "Zéro engagement · désinscription en un clic",
    note: "Pas de spam. On t'écrit pour le lancement, c'est tout.",
  },
  en: {
    eyebrow: "Early access",
    title: "Join the list — founder access",
    subtitle: "Pacevo is coming. Drop your email: you'll be the first to know at launch.",
    offer: "🎁 Founder offer: the first {places} sign-ups get priority access and −{remise}% on their first year.",
    b1: "Priority access at launch",
    b2: "−{remise}% for the first year (first 100)",
    b3: "No commitment · one-click unsubscribe",
    note: "No spam. We'll email you about the launch, nothing else.",
  },
  de: {
    eyebrow: "Vorpremiere",
    title: "Tritt der Liste bei — Gründerzugang",
    subtitle: "Pacevo kommt. Hinterlasse deine E-Mail: Du erfährst es beim Start als Erste·r.",
    offer: "🎁 Gründerangebot: Die ersten {places} Anmeldungen erhalten bevorzugten Zugang und −{remise}% im ersten Jahr.",
    b1: "Bevorzugter Zugang zum Start",
    b2: "−{remise}% im ersten Jahr (erste 100)",
    b3: "Keine Bindung · Abmeldung mit einem Klick",
    note: "Kein Spam. Wir schreiben dir nur zum Start.",
  },
  es: {
    eyebrow: "Preestreno",
    title: "Únete a la lista — acceso fundador",
    subtitle: "Pacevo llega pronto. Deja tu correo: serás de los primeros en saberlo al lanzamiento.",
    offer: "🎁 Oferta fundador: las primeras {places} personas obtienen acceso prioritario y −{remise}% en su primer año.",
    b1: "Acceso prioritario en el lanzamiento",
    b2: "−{remise}% el primer año (primeras 100)",
    b3: "Sin compromiso · baja en un clic",
    note: "Sin spam. Solo te escribiremos para el lanzamiento.",
  },
  pt: {
    eyebrow: "Pré-estreia",
    title: "Junta-te à lista — acesso fundador",
    subtitle: "O Pacevo está a chegar. Deixa o teu e-mail: serás dos primeiros a saber no lançamento.",
    offer: "🎁 Oferta fundador: os primeiros {places} inscritos têm acesso prioritário e −{remise}% no primeiro ano.",
    b1: "Acesso prioritário no lançamento",
    b2: "−{remise}% no primeiro ano (primeiros 100)",
    b3: "Sem compromisso · anular em um clique",
    note: "Sem spam. Escrevemos-te só para o lançamento.",
  },
};

// Avertissement santé affiché en bas de chaque page du dashboard (l'app donne des conseils
// d'entraînement via l'IA → ne pas se présenter comme dispositif médical).
export function MedicalDisclaimer() {
  return (
    <footer className="shrink-0 border-t border-zinc-100 bg-white px-6 py-2.5">
      <p className="text-center text-[11px] leading-relaxed text-zinc-400">
        ⚕️ Les analyses, plans et conseils de Running &amp; Trail Empire sont fournis à titre informatif et
        <b className="font-semibold text-zinc-500"> ne remplacent pas un avis médical</b>. Consulte un médecin
        avant de reprendre ou d&apos;intensifier le sport. ·{" "}
        <a href="/mentions-legales" className="hover:text-zinc-600 underline-offset-2 hover:underline">Mentions légales</a> ·{" "}
        <a href="/terms" className="hover:text-zinc-600 underline-offset-2 hover:underline">CGU</a> ·{" "}
        <a href="/confidentialite" className="hover:text-zinc-600 underline-offset-2 hover:underline">Confidentialité</a>
      </p>
    </footer>
  );
}

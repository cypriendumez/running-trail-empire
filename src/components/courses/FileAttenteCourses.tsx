"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageProvider";
import { envoyerAttente, lireAttente } from "@/lib/courses/horsLigne";

/**
 * LES COURSES ENREGISTRÉES SANS RÉSEAU REPARTENT TOUTES SEULES.
 *
 * Monté dans le layout du tableau de bord : à l'ouverture de n'importe quelle page et à
 * chaque retour du réseau (`online`), la file d'attente du téléphone est renvoyée vers
 * `/api/workouts/log`, une course à la fois, dans l'ordre. Rien à faire pour l'athlète —
 * c'est ce qui rend l'enregistrement sans 4G aussi simple que sur Strava.
 */
const T: Record<string, { envoyee: string; envoyees: string }> = {
  fr: { envoyee: "Course envoyée depuis ton téléphone.", envoyees: "{n} courses envoyées depuis ton téléphone." },
  en: { envoyee: "Run uploaded from your phone.", envoyees: "{n} runs uploaded from your phone." },
  de: { envoyee: "Lauf vom Handy gesendet.", envoyees: "{n} Läufe vom Handy gesendet." },
  es: { envoyee: "Carrera enviada desde tu móvil.", envoyees: "{n} carreras enviadas desde tu móvil." },
  pt: { envoyee: "Corrida enviada do teu telemóvel.", envoyees: "{n} corridas enviadas do teu telemóvel." },
};

export function FileAttenteCourses() {
  const { lang } = useT();
  const enCoursRef = useRef(false);

  useEffect(() => {
    const t = T[lang] ?? T.fr;
    const vider = async () => {
      if (enCoursRef.current || typeof localStorage === "undefined") return;
      if (lireAttente(localStorage).length === 0) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      enCoursRef.current = true;
      try {
        const { envoyees } = await envoyerAttente(localStorage, async (corps) => {
          const r = await fetch("/api/workouts/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
          const j = await r.json().catch(() => ({}));
          return { ok: r.ok && Boolean((j as { ok?: boolean }).ok), refusee: r.status >= 400 && r.status < 500 };
        });
        if (envoyees === 1) toast.success(t.envoyee, { duration: 6000 });
        else if (envoyees > 1) toast.success(t.envoyees.replace("{n}", String(envoyees)), { duration: 6000 });
      } finally { enCoursRef.current = false; }
    };
    vider();
    window.addEventListener("online", vider);
    return () => window.removeEventListener("online", vider);
  }, [lang]);

  return null;
}

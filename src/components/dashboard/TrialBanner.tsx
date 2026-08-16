"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  L'ÉTAT DE L'ABONNEMENT, DIT AVANT D'ÊTRE SUBI.
//
//  Le pire moment pour apprendre qu'un essai existait, c'est le jour où il se
//  termine. La bannière ne s'affiche donc pas en permanence — un bandeau planté
//  là pendant trente jours devient invisible au bout de trois — mais dans les
//  DERNIERS JOURS, puis une fois l'essai fini.
//
//  ⚠️ Aucun compte à rebours anxiogène, même logique que la série : on annonce un
//  fait daté, on ne met pas la pression. Et à l'expiration le ton dit d'abord ce
//  qui RESTE (l'historique), pas ce qui est perdu.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { EtatAcces } from "@/lib/billing/access";

/** En deçà de ce nombre de jours restants, on prévient. Au-delà, on se tait. */
const SEUIL_RAPPEL = 7;

export function TrialBanner({ acces }: { acces: EtatAcces | null }) {
  const { t } = useT();
  if (!acces) return null;

  // ⚠️ Plus de « consultation » : l'essai fini retombe sur le palier GRATUIT permanent.
  // On ne prévient donc que si l'essai vient de se terminer — et le message dit ce qui
  // CONTINUE (le plan, la synchro, les courses), pas ce qui est perdu.
  if (acces.etat === "gratuit" && acces.essaiExpire) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{t("trial.over.title")}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">{t("trial.over.desc")}</p>
        </div>
        <Link href="/pricing" className="flex-shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
          {t("trial.cta")}
        </Link>
      </div>
    );
  }

  const n = acces.joursRestants;
  if (acces.etat !== "essai" || n == null || n > SEUIL_RAPPEL) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d6efe4] bg-[#f2fbf7] px-4 py-3.5">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#059669]">
        <Clock className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#11201d]">
          {n === 1 ? t("trial.left.one") : t("trial.left.n", { n })}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[#4d6b64]">{t("trial.left.desc")}</p>
      </div>
      <Link href="/pricing" className="flex-shrink-0 rounded-xl bg-[#11201d] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0b1714]">
        {t("trial.cta")}
      </Link>
    </div>
  );
}

// Squelette affiché INSTANTANÉMENT à chaque navigation d'onglet (Suspense du segment
// /dashboard) — supprime la sensation d'écran figé pendant le rendu serveur dynamique.
// Générique volontairement : une barre de titre + une grille de cartes, qui colle à la
// plupart des pages (Courses, Trail, Boutique, Ligues, Dashboard…).
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-zinc-200/80" />
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-zinc-200/80" />
          <div className="h-3 w-64 rounded bg-zinc-100" />
        </div>
      </div>

      {/* Barre de filtres / actions */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-zinc-100" />
        ))}
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
            <div className="h-32 bg-zinc-100" />
            <div className="space-y-2.5 p-4">
              <div className="h-4 w-3/4 rounded bg-zinc-200/80" />
              <div className="h-3 w-1/2 rounded bg-zinc-100" />
              <div className="h-3 w-2/3 rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

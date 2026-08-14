"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  LE CLUB — fil social de Pacevo.
//
//  Parti pris esthétique : on n'imite pas la carte-liste dense d'un fil classique.
//  Chaque séance publiée est une CARTE-PERFORMANCE — les chiffres d'abord, gros et
//  lisibles, l'auteur en second. Un fil sportif se lit en diagonale : ce qu'on veut
//  savoir d'une sortie, c'est la distance et l'allure, pas la prose.
//
//  Règle tenue partout ici : on n'affiche QUE les chiffres qui existent (voir
//  `statLine`). Une carte qui montrerait « 0,0 km » pour une séance sans distance
//  mentirait sur la sortie de quelqu'un.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Search, UserPlus, UserCheck, Trash2, Send, Users, Sparkles, ImagePlus, X, Loader2 } from "lucide-react";
import { timeAgo, statLine, likesLabel } from "@/lib/social/feed";

type Author = { id: string; full_name?: string | null; avatar_url?: string | null };
type Workout = {
  id: string; title?: string | null; type?: string | null; sport?: string | null; date?: string | null;
  distance_km?: number | null; duration_seconds?: number | null; elevation_gain_m?: number | null;
};
type Post = {
  id: string; user_id: string; body?: string | null; created_at: string; photo_urls?: string[] | null;
  kudos_count: number; comments_count: number; kudoed: boolean; mine: boolean;
  author?: Author | null; workout?: Workout | null;
};
type Athlete = { id: string; full_name?: string | null; avatar_url?: string | null; league?: string | null; discipline_score?: number | null; following: boolean };
type Comment = { id: string; body: string; created_at: string; author?: Author | null };

const initials = (name?: string | null) =>
  (name ?? "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

function Avatar({ author, size = 40 }: { author?: Author | null; size?: number }) {
  const s = { width: size, height: size };
  if (author?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.avatar_url} alt="" style={s} className="rounded-full object-cover ring-2 ring-white" />;
  }
  return (
    <div style={s} className="flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white ring-2 ring-white">
      {initials(author?.full_name)}
    </div>
  );
}

export function SocialHub({ recentWorkouts, clubs = [] }: {
  recentWorkouts: Workout[];
  /** Clubs dont l'athlète est membre — seuls ceux-là peuvent filtrer son fil. */
  clubs?: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"feed" | "athletes">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState<string>("");

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/social/feed${club ? `?club=${club}` : ""}`);
      const j = await r.json();
      setPosts(j.posts ?? []);
      setFollowingCount(j.followingCount ?? 0);
    } catch { /* le fil reste vide, l'écran le dit explicitement */ }
    setLoading(false);
  }, [club]);

  useEffect(() => { void loadFeed(); }, [loadFeed]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      {/* Le bouton « Ajouter des amis » est PERMANENT et dans l'en-tête. Il n'était
          auparavant accessible que par l'onglet « Athlètes », ou par le message du fil
          vide : deux chemins qu'il fallait deviner. Une action aussi centrale ne doit
          pas dépendre d'un onglet qu'on pense à ouvrir. */}
      <header className="flex flex-wrap items-center justify-between gap-3 pt-6 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Le Club</h1>
          <p className="mt-1 text-sm text-zinc-500">Les sorties de ceux que tu suis, et les tiennes.</p>
        </div>
        <button onClick={() => setTab("athletes")}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
          <UserPlus className="h-4 w-4" />
          Ajouter des amis
        </button>
      </header>

      <div className="mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {([["feed", "Fil"], ["athletes", followingCount > 0 ? `Athlètes · ${followingCount}` : "Trouver des athlètes"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === k ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "feed" && clubs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: "", name: "Tout le fil" }, ...clubs].map((c) => (
            <button key={c.id || "tout"} onClick={() => setClub(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                club === c.id ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {tab === "feed" ? (
        <>
          <Composer workouts={recentWorkouts} onPublished={loadFeed} />
          {loading ? (
            <div className="space-y-4">{[0, 1].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-zinc-100" />
            ))}</div>
          ) : posts.length === 0 ? (
            <EmptyFeed followingCount={followingCount} club={club ? clubs.find((c) => c.id === club)?.name ?? null : null} onFind={() => setTab("athletes")} />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => <PostCard key={p.id} post={p} onChange={loadFeed} />)}
            </div>
          )}
        </>
      ) : (
        <AthleteFinder onFollowChange={loadFeed} />
      )}
    </div>
  );
}

/**
 * Le fil vide a deux causes opposées et l'écran doit les distinguer : « tu ne suis
 * personne » appelle l'annuaire, « personne n'a rien publié » appelle la publication.
 * Un message unique « rien à afficher » serait un cul-de-sac.
 */
function EmptyFeed({ followingCount, club, onFind }: { followingCount: number; club?: string | null; onFind: () => void }) {
  const seul = followingCount === 0 && !club;
  if (club) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
        <p className="font-semibold text-zinc-900">Rien dans {club}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
          Aucun membre de ce club n&apos;a publié de séance visible pour toi.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        {seul ? <Users className="h-6 w-6 text-emerald-600" /> : <Sparkles className="h-6 w-6 text-emerald-600" />}
      </div>
      <p className="font-semibold text-zinc-900">{seul ? "Tu ne suis encore personne" : "Rien de neuf pour l'instant"}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
        {seul
          ? "Trouve des athlètes à suivre : leurs sorties apparaîtront ici."
          : "Les athlètes que tu suis n'ont rien publié. Ouvre le bal avec ta dernière séance."}
      </p>
      {seul && (
        <button onClick={onFind}
          className="mt-5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
          Trouver des athlètes
        </button>
      )}
    </div>
  );
}

function Composer({ workouts, onPublished }: { workouts: Workout[]; onPublished: () => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("followers");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function publish() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/social/post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, workoutId, visibility, photoUrls: photos }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "Publication impossible"); setBusy(false); return; }
      setBody(""); setWorkoutId(null); setPhotos([]); setOpen(false); onPublished();
    } catch { setErr("Publication impossible"); }
    setBusy(false);
  }


  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setErr(null);
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const j = await r.json();
        // On n'ajoute la vignette QUE si le serveur a bien renvoyé une URL : afficher
        // une image locale « en attente » ferait croire à un envoi réussi qui ne l'est pas.
        if (r.ok && j.url) setPhotos((p) => [...p, j.url].slice(0, 4));
        else setErr(j.error ?? "Photo refusée");
      } catch { setErr("Envoi de la photo impossible"); }
    }
    setUploading(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
          <Sparkles className="h-4 w-4 text-emerald-600" />
        </div>
        <span className="text-sm text-zinc-500">Partager une séance…</span>
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus
        placeholder="Comment s'est passée cette sortie ?"
        className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />


      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((u) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-900 p-1 text-white shadow">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {workouts.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Joindre une séance</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {workouts.map((w) => {
              const sel = workoutId === w.id;
              return (
                <button key={w.id} onClick={() => setWorkoutId(sel ? null : w.id)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${
                    sel ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                  <div className="font-semibold text-zinc-800">{w.title || w.type || "Séance"}</div>
                  <div className="text-zinc-500">
                    {w.date ? new Date(w.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}
                    {w.distance_km ? ` · ${w.distance_km.toFixed(1).replace(".", ",")} km` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {/* Le défaut est « Mes abonnés » et non « Public » : une séance porte une trace
            qui part du domicile. Le réglage par défaut ne doit jamais exposer ça. */}
        <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 transition hover:border-emerald-300 ${photos.length >= 4 ? "pointer-events-none opacity-40" : ""}`}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {photos.length ? `${photos.length}/4` : "Photo"}
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
        </label>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-600 outline-none">
          <option value="followers">Mes abonnés</option>
          <option value="public">Tout le monde</option>
          <option value="private">Moi seul</option>
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => { setOpen(false); setErr(null); }} className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700">Annuler</button>
          <button onClick={publish} disabled={busy || uploading || (!body.trim() && !workoutId && photos.length === 0)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40">
            {busy ? "Publication…" : "Publier"}
          </button>
        </div>
      </div>
      {/* ⚠️ Le bucket de stockage est PUBLIC (partagé avec les pièces jointes de la
          messagerie). Restreindre la publication à ses abonnés ne rend donc PAS la
          photo secrète : son URL reste atteignable par qui la possède. Le taire
          laisserait croire à une confidentialité qui n'existe pas. */}
      {photos.length > 0 && visibility !== "public" && (
        <p className="mt-2 text-xs text-amber-700">
          La publication sera limitée à tes abonnés, mais le fichier photo reste
          accessible à qui possède son adresse. Évite les images que tu ne montrerais
          pas publiquement.
        </p>
      )}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}

function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const [kudoed, setKudoed] = useState(post.kudoed);
  const [count, setCount] = useState(post.kudos_count);
  const [showComments, setShowComments] = useState(false);
  const stats = post.workout ? statLine(post.workout) : [];

  async function toggleKudos() {
    // Bascule optimiste : le « j'aime » doit répondre à l'instant. En cas d'échec
    // réseau on REVIENT en arrière — laisser un cœur allumé sur un encouragement qui
    // n'a pas été enregistré serait un mensonge à l'écran.
    const next = !kudoed;
    setKudoed(next); setCount((c) => c + (next ? 1 : -1));
    try {
      const r = await fetch("/api/social/interact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, action: "kudos" }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setKudoed(!next); setCount((c) => c + (next ? -1 : 1));
    }
  }

  async function remove() {
    await fetch(`/api/social/post?id=${post.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar author={post.author} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-900">{post.author?.full_name || "Athlète"}</div>
          <div className="text-xs text-zinc-400">{timeAgo(post.created_at)}</div>
        </div>
        {post.mine && (
          <button onClick={remove} title="Supprimer" className="rounded-lg p-2 text-zinc-300 transition hover:bg-red-50 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {post.body && <p className="px-4 pb-3 text-sm leading-relaxed text-zinc-700">{post.body}</p>}

      {!!post.photo_urls?.length && (
        <div className={`mb-3 grid gap-1 px-4 ${post.photo_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.photo_urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" loading="lazy"
              className={`w-full rounded-xl object-cover ${post.photo_urls!.length > 1 ? "h-40" : "max-h-96"}`} />
          ))}
        </div>
      )}

      {post.workout && (
        <div className="mx-4 mb-3 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 text-white">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            {post.workout.title || post.workout.type || "Séance"}
          </div>
          {stats.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-xl font-bold leading-tight">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            // Aucune mesure exploitable : on le DIT au lieu d'aligner des tirets.
            <p className="text-xs text-zinc-400">Séance enregistrée sans mesure détaillée.</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-zinc-100 px-2 py-2">
        <button onClick={toggleKudos}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            kudoed ? "text-emerald-600" : "text-zinc-500 hover:bg-zinc-50"}`}>
          <Heart className={`h-4 w-4 ${kudoed ? "fill-emerald-600" : ""}`} />
          {likesLabel(count)}
        </button>
        <button onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-50">
          <MessageCircle className="h-4 w-4" />
          {post.comments_count > 0 ? post.comments_count : "Commenter"}
        </button>
      </div>

      {showComments && <Comments postId={post.id} />}
    </article>
  );
}

function Comments({ postId }: { postId: string }) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/social/interact?postId=${postId}`);
    const j = await r.json();
    setItems(j.comments ?? []);
  }, [postId]);
  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    await fetch("/api/social/interact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, action: "comment", body: text }),
    });
    setText(""); setBusy(false); void load();
  }

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
      {items === null ? (
        <div className="h-8 animate-pulse rounded bg-zinc-200" />
      ) : items.length === 0 ? (
        <p className="mb-3 text-xs text-zinc-400">Aucun commentaire — sois le premier.</p>
      ) : (
        <div className="mb-3 space-y-3">
          {items.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar author={c.author} size={28} />
              <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2">
                <div className="text-xs font-semibold text-zinc-800">{c.author?.full_name || "Athlète"}</div>
                <p className="text-xs text-zinc-600">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Écrire un commentaire…"
          className="flex-1 rounded-full border border-zinc-200 px-4 py-2 text-xs outline-none focus:border-emerald-400" />
        <button onClick={send} disabled={busy || !text.trim()}
          className="rounded-full bg-emerald-600 p-2 text-white transition hover:bg-emerald-700 disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AthleteFinder({ onFollowChange }: { onFollowChange: () => void }) {
  const [q, setQ] = useState("");
  const [athletes, setAthletes] = useState<Athlete[] | null>(null);

  const load = useCallback(async (query: string) => {
    const r = await fetch(`/api/social/follow?q=${encodeURIComponent(query)}`);
    const j = await r.json();
    setAthletes(j.athletes ?? []);
  }, []);

  // Recherche différée : sans ce délai, chaque frappe déclenchait une requête.
  useEffect(() => {
    const id = setTimeout(() => void load(q), q ? 300 : 0);
    return () => clearTimeout(id);
  }, [q, load]);

  async function toggle(a: Athlete) {
    setAthletes((prev) => prev?.map((x) => x.id === a.id ? { ...x, following: !x.following } : x) ?? null);
    const r = await fetch("/api/social/follow", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: a.id }),
    });
    if (!r.ok) {
      setAthletes((prev) => prev?.map((x) => x.id === a.id ? { ...x, following: a.following } : x) ?? null);
      return;
    }
    onFollowChange();
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un athlète par son nom…"
          className="w-full rounded-full border border-zinc-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-400" />
      </div>

      {athletes === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />)}</div>
      ) : athletes.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-400">
          {q ? `Aucun athlète ne correspond à « ${q} ».` : "Aucun athlète à suggérer pour l'instant."}
        </p>
      ) : (
        <div className="space-y-2">
          {!q && <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Suggestions</p>}
          {athletes.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <Avatar author={a} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-900">{a.full_name || "Athlète"}</div>
                {/* On n'affiche la ligue et le score QUE s'ils existent : un « Ligue —,
                    score 0 » ferait passer un compte neuf pour un compte à l'abandon. */}
                {(a.league || (a.discipline_score ?? 0) > 0) && (
                  <div className="text-xs text-zinc-400">
                    {[a.league, (a.discipline_score ?? 0) > 0 ? `Discipline ${a.discipline_score}` : null]
                      .filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <button onClick={() => toggle(a)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  a.following
                    ? "border border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                {a.following ? <><UserCheck className="h-3.5 w-3.5" /> Suivi</> : <><UserPlus className="h-3.5 w-3.5" /> Suivre</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

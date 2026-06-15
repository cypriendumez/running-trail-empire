// Palette de couleurs de profil (avatar) — choisie dans les Paramètres, appliquée partout.
export type AvatarColor = { key: string; label: string; bg: string; fg: string };

export const AVATAR_COLORS: AvatarColor[] = [
  { key: "emerald", label: "Émeraude", bg: "#d1fae5", fg: "#047857" },
  { key: "teal", label: "Sarcelle", bg: "#ccfbf1", fg: "#0f766e" },
  { key: "cyan", label: "Cyan", bg: "#cffafe", fg: "#0e7490" },
  { key: "blue", label: "Bleu", bg: "#dbeafe", fg: "#1d4ed8" },
  { key: "indigo", label: "Indigo", bg: "#e0e7ff", fg: "#4338ca" },
  { key: "violet", label: "Violet", bg: "#ede9fe", fg: "#6d28d9" },
  { key: "fuchsia", label: "Fuchsia", bg: "#fae8ff", fg: "#a21caf" },
  { key: "pink", label: "Rose", bg: "#fce7f3", fg: "#be185d" },
  { key: "red", label: "Rouge", bg: "#fee2e2", fg: "#b91c1c" },
  { key: "orange", label: "Orange", bg: "#ffedd5", fg: "#c2410c" },
  { key: "amber", label: "Ambre", bg: "#fef3c7", fg: "#b45309" },
  { key: "lime", label: "Citron", bg: "#ecfccb", fg: "#4d7c0f" },
  { key: "slate", label: "Ardoise", bg: "#e2e8f0", fg: "#334155" },
  { key: "zinc", label: "Graphite", bg: "#e4e4e7", fg: "#3f3f46" },
];

export function colorOf(key: string | null | undefined): AvatarColor {
  return AVATAR_COLORS.find((c) => c.key === key) ?? AVATAR_COLORS[0];
}

import {
  Footprints, Flag, Route, CalendarRange, Flame, CalendarCheck, ListChecks, Trees, Mountain, MountainSnow, Zap,
  Gauge, Timer, Hourglass, CalendarDays, Repeat, Leaf, Snowflake, TrendingUp, Award, Gem, Diamond, Medal,
  type LucideIcon,
} from "lucide-react";

/**
 * LES ICÔNES DE LA PAGE LIGUES — dessinées, plus d'emoji.
 *
 * Cyprien, 29/09/2026 : « améliore les emoji, ça fait trop IA ». 🏃 ⛰️ 🎯 🥉 💎 rendaient
 * différemment d'un téléphone à l'autre (Apple, Google, Samsung n'ont pas les mêmes) et
 * juraient avec les icônes au trait du reste de l'app. Chaque badge prend l'icône de sa
 * FAMILLE (distance, volume, régularité, dénivelé…) dans une médaille aux couleurs de sa
 * rareté : 78 badges se lisent d'un coup d'œil, par famille, sans 78 dessins à tenir.
 *
 * Les emoji envoyés par le serveur (`badge.icon`, `c.icon`) ne sont plus affichés.
 */

/** La famille d'un badge, déduite de son identifiant (stable, jamais traduit). */
export function iconeBadge(id: string): LucideIcon {
  if (/^(first_trail|trail_)/.test(id)) return Trees;
  if (/^(vert_|everest|elev_)/.test(id)) return id === "everest" || id.startsWith("elev_") ? MountainSnow : Mountain;
  if (/^(speed_|fast_)/.test(id)) return id.startsWith("fast_") ? Gauge : Zap;
  if (/^hours_/.test(id)) return Timer;
  if (/^long_(3h|6h)$/.test(id)) return Hourglass;
  if (/^plan_streak_/.test(id)) return Flame;
  if (/^(days_|weeks_)/.test(id)) return CalendarCheck;
  if (/^sessions_/.test(id)) return ListChecks;
  if (/^(month_|months100_)/.test(id)) return CalendarRange;
  if (/^(km_|tdf|seasoned)/.test(id)) return Route;
  if (id === "bigweek_100") return TrendingUp;
  if (id === "weekend_10") return CalendarDays;
  if (/^double_/.test(id)) return Repeat;
  if (id === "four_seasons") return Leaf;
  if (id === "winter") return Snowflake;
  if (/^(half|marathon|sub4_marathon|ultra_|miles_)/.test(id)) return Flag;
  return Footprints;   // premières distances, sorties longues
}

/** Les défis automatiques, par ce qu'ils mesurent. */
export function iconeDefi(id: string): LucideIcon {
  if (/trail/.test(id)) return Trees;
  if (/elev/.test(id)) return Mountain;
  if (/fast/.test(id)) return Zap;
  if (/long|marathon/.test(id)) return Flag;
  if (/weekend/.test(id)) return CalendarDays;
  if (/sessions|days/.test(id)) return CalendarCheck;
  return Route;   // kilomètres
}

/** Les paliers : trois médailles, puis deux pierres. */
export const ICONE_PALIER: Record<string, LucideIcon> = {
  bronze: Medal, silver: Medal, gold: Award, platinum: Gem, diamond: Diamond,
};


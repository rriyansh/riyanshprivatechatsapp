// Accent presets for chat bubbles + primary color.
// Each accent maps to two HSL stops (base + glow) used by --primary, --primary-glow, --ring.
// Values were tuned to look great on both light and dark surfaces.

export type AccentKey =
  | "blue"
  | "purple"
  | "pink"
  | "green"
  | "orange"
  | "red"
  | "graphite";

type AccentPalette = {
  label: string;
  light: { primary: string; glow: string };
  dark: { primary: string; glow: string };
};

export const ACCENTS: Record<AccentKey, AccentPalette> = {
  blue: {
    label: "iMessage Blue",
    light: { primary: "211 100% 50%", glow: "215 100% 62%" },
    dark: { primary: "211 100% 55%", glow: "215 100% 65%" },
  },
  purple: {
    label: "Lavender",
    light: { primary: "262 83% 58%", glow: "270 90% 70%" },
    dark: { primary: "262 90% 65%", glow: "270 95% 72%" },
  },
  pink: {
    label: "Sunset Pink",
    light: { primary: "335 85% 58%", glow: "345 90% 68%" },
    dark: { primary: "335 90% 62%", glow: "345 95% 70%" },
  },
  green: {
    label: "Mint",
    light: { primary: "152 70% 42%", glow: "160 75% 52%" },
    dark: { primary: "152 70% 48%", glow: "160 75% 56%" },
  },
  orange: {
    label: "Tangerine",
    light: { primary: "22 95% 55%", glow: "30 100% 62%" },
    dark: { primary: "22 95% 58%", glow: "30 100% 65%" },
  },
  red: {
    label: "Crimson",
    light: { primary: "0 80% 55%", glow: "8 90% 62%" },
    dark: { primary: "0 80% 58%", glow: "8 90% 65%" },
  },
  graphite: {
    label: "Graphite",
    light: { primary: "222 20% 28%", glow: "222 18% 38%" },
    dark: { primary: "220 12% 78%", glow: "220 12% 88%" },
  },
};

export const ACCENT_KEYS: AccentKey[] = [
  "blue",
  "purple",
  "pink",
  "green",
  "orange",
  "red",
  "graphite",
];

/**
 * Apply an accent + dark-mode flag to the document root by overwriting the
 * --primary, --primary-glow, and --ring CSS variables. This affects every
 * component that uses semantic tokens — bubble gradient, send button, focus
 * rings, links, etc.
 */
export const applyAccent = (
  accent: AccentKey,
  isDark: boolean,
  el: HTMLElement = document.documentElement
) => {
  const palette = ACCENTS[accent] ?? ACCENTS.blue;
  const tone = isDark ? palette.dark : palette.light;
  el.style.setProperty("--primary", tone.primary);
  el.style.setProperty("--primary-glow", tone.glow);
  el.style.setProperty("--ring", tone.primary);
};

export const accentSwatch = (accent: AccentKey): string => {
  const tone = ACCENTS[accent].light;
  return `linear-gradient(135deg, hsl(${tone.primary}), hsl(${ACCENTS[accent].light.glow}))`;
};

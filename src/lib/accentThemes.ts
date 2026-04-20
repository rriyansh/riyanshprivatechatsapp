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

// X-inspired monochrome accents — all greyscale, no color.
export const ACCENTS: Record<AccentKey, AccentPalette> = {
  blue: {
    label: "Ink",
    light: { primary: "0 0% 0%", glow: "0 0% 18%" },
    dark: { primary: "0 0% 100%", glow: "0 0% 85%" },
  },
  purple: {
    label: "Smoke",
    light: { primary: "0 0% 22%", glow: "0 0% 36%" },
    dark: { primary: "0 0% 88%", glow: "0 0% 72%" },
  },
  pink: {
    label: "Silver",
    light: { primary: "0 0% 38%", glow: "0 0% 52%" },
    dark: { primary: "0 0% 78%", glow: "0 0% 62%" },
  },
  green: {
    label: "Steel",
    light: { primary: "0 0% 28%", glow: "0 0% 44%" },
    dark: { primary: "0 0% 82%", glow: "0 0% 68%" },
  },
  orange: {
    label: "Charcoal",
    light: { primary: "0 0% 14%", glow: "0 0% 28%" },
    dark: { primary: "0 0% 92%", glow: "0 0% 78%" },
  },
  red: {
    label: "Onyx",
    light: { primary: "0 0% 8%", glow: "0 0% 22%" },
    dark: { primary: "0 0% 96%", glow: "0 0% 80%" },
  },
  graphite: {
    label: "Graphite",
    light: { primary: "0 0% 32%", glow: "0 0% 46%" },
    dark: { primary: "0 0% 80%", glow: "0 0% 66%" },
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

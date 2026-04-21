/**
 * Per-chat wallpaper stored locally (per device).
 * Key format: velto:wallpaper:{type}:{id}
 *   type = "dm" | "group"
 *   id   = partner user_id or group_id
 *
 * Value is a data URL (base64) for picked images, or one of the preset ids prefixed with "preset:".
 */
const KEY = (type: "dm" | "group", id: string) => `velto:wallpaper:${type}:${id}`;

export type WallpaperPreset = {
  id: string;
  label: string;
  /** CSS background value */
  background: string;
};

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "default",
    label: "Default",
    background: "transparent",
  },
  {
    id: "ink",
    label: "Ink",
    background:
      "radial-gradient(at 20% 10%, hsl(var(--muted)) 0%, transparent 40%), radial-gradient(at 90% 90%, hsl(var(--muted)) 0%, transparent 40%), hsl(var(--background))",
  },
  {
    id: "dots",
    label: "Dots",
    background:
      "radial-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px) 0 0/18px 18px, hsl(var(--background))",
  },
  {
    id: "grid",
    label: "Grid",
    background:
      "linear-gradient(hsl(var(--foreground) / 0.05) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, hsl(var(--foreground) / 0.05) 1px, transparent 1px) 0 0/24px 24px, hsl(var(--background))",
  },
  {
    id: "noir",
    label: "Noir",
    background:
      "linear-gradient(135deg, hsl(0 0% 4%) 0%, hsl(0 0% 12%) 50%, hsl(0 0% 4%) 100%)",
  },
];

export const getWallpaper = (type: "dm" | "group", id: string): string | null => {
  try {
    return localStorage.getItem(KEY(type, id));
  } catch {
    return null;
  }
};

export const setWallpaper = (type: "dm" | "group", id: string, value: string) => {
  try {
    localStorage.setItem(KEY(type, id), value);
  } catch {
    /* quota exceeded — silently ignore */
  }
};

export const clearWallpaper = (type: "dm" | "group", id: string) => {
  try {
    localStorage.removeItem(KEY(type, id));
  } catch {
    /* ignore */
  }
};

/** Resolves stored value into a CSS background string suitable for inline style. */
export const resolveWallpaperStyle = (value: string | null): React.CSSProperties => {
  if (!value) return {};
  if (value.startsWith("preset:")) {
    const presetId = value.slice("preset:".length);
    const preset = WALLPAPER_PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.id === "default") return {};
    return { background: preset.background };
  }
  // data URL or http URL
  return {
    backgroundImage: `url(${value})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
};

/** Read a File as a data URL (compressed by caller if needed). */
export const fileToDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

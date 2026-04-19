// PIN-based app lock. PIN is hashed with SHA-256 + a per-install random salt
// stored in localStorage. Not military-grade (web has no secure enclave),
// but prevents casual unlocking and works as the basis for biometric in native.

export type LockMode = "off" | "open" | "background";

const KEYS = {
  hash: "applock.hash",
  salt: "applock.salt",
  mode: "applock.mode",
  unlockedAt: "applock.unlocked_at", // ms timestamp this session
} as const;

const BG_GRACE_MS = 30_000; // re-lock after 30s in background

// ---------- crypto helpers ----------

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (s: string) => {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(buf);
};

const randomSalt = () => {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
};

// ---------- public API ----------

export const isPinSet = () => !!localStorage.getItem(KEYS.hash);

export const getMode = (): LockMode => {
  const m = localStorage.getItem(KEYS.mode) as LockMode | null;
  if (m === "open" || m === "background" || m === "off") return m;
  return "off";
};

export const setMode = (mode: LockMode) => {
  localStorage.setItem(KEYS.mode, mode);
};

export const setPin = async (pin: string) => {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4–6 digits");
  const salt = randomSalt();
  const hash = await sha256(salt + pin);
  localStorage.setItem(KEYS.salt, salt);
  localStorage.setItem(KEYS.hash, hash);
};

export const verifyPin = async (pin: string) => {
  const salt = localStorage.getItem(KEYS.salt);
  const hash = localStorage.getItem(KEYS.hash);
  if (!salt || !hash) return false;
  const candidate = await sha256(salt + pin);
  return candidate === hash;
};

export const clearPin = () => {
  localStorage.removeItem(KEYS.hash);
  localStorage.removeItem(KEYS.salt);
  localStorage.setItem(KEYS.mode, "off");
  sessionStorage.removeItem(KEYS.unlockedAt);
};

export const markUnlocked = () => {
  sessionStorage.setItem(KEYS.unlockedAt, String(Date.now()));
};

export const wasRecentlyUnlocked = () => {
  return !!sessionStorage.getItem(KEYS.unlockedAt);
};

export const stampBackgroundExit = () => {
  sessionStorage.setItem("applock.bg_at", String(Date.now()));
};

export const shouldLockAfterBackground = () => {
  const t = Number(sessionStorage.getItem("applock.bg_at") || 0);
  if (!t) return false;
  return Date.now() - t > BG_GRACE_MS;
};

export const clearBackgroundStamp = () => {
  sessionStorage.removeItem("applock.bg_at");
};

export const BG_GRACE_SEC = BG_GRACE_MS / 1000;

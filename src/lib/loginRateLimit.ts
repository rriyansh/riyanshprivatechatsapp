// Lightweight client-side login rate limiter.
// NOTE: Real rate limiting must be enforced server-side. This is a UX guard
// that complements Supabase Auth's built-in rate limits to slow down brute force
// attempts from this device.

const KEY = "pc_login_attempts_v1";
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute window
const LOCK_MS = 60_000; // lock for 1 minute after exceeding

type State = { attempts: number[]; lockedUntil?: number };

const read = (): State => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { attempts: [] };
    return JSON.parse(raw);
  } catch {
    return { attempts: [] };
  }
};

const write = (s: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export const checkLoginAllowed = (): { allowed: boolean; retryInSec: number } => {
  const now = Date.now();
  const s = read();
  if (s.lockedUntil && s.lockedUntil > now) {
    return { allowed: false, retryInSec: Math.ceil((s.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryInSec: 0 };
};

export const recordFailedLogin = () => {
  const now = Date.now();
  const s = read();
  const recent = (s.attempts || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  const next: State = { attempts: recent };
  if (recent.length >= MAX_ATTEMPTS) {
    next.lockedUntil = now + LOCK_MS;
    next.attempts = [];
  }
  write(next);
};

export const resetLoginAttempts = () => write({ attempts: [] });

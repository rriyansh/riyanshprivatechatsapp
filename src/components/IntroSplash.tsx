import { useEffect, useState } from "react";

/**
 * VeltoChat motion-graphic intro.
 * Plays once after every successful login — gated by a sessionStorage flag
 * cleared on signOut so the next login replays it.
 */
export const IntroSplash = ({ onDone }: { onDone: () => void }) => {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 80);
    const t2 = window.setTimeout(() => setPhase(2), 900);
    const t3 = window.setTimeout(() => setPhase(3), 2100);
    const t4 = window.setTimeout(() => onDone(), 2700);
    return () => {
      [t1, t2, t3, t4].forEach((t) => window.clearTimeout(t));
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
      style={{
        opacity: phase === 3 ? 0 : 1,
        transition: "opacity 600ms ease-out",
      }}
      aria-label="VeltoChat intro"
    >
      {/* Animated rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="absolute h-[60vmin] w-[60vmin] rounded-full border border-foreground/20"
          style={{
            transform: phase >= 1 ? "scale(1)" : "scale(0.4)",
            opacity: phase >= 2 ? 0 : 1,
            transition: "transform 1.4s cubic-bezier(0.16,1,0.3,1), opacity 1s ease-out",
          }}
        />
        <div
          className="absolute h-[40vmin] w-[40vmin] rounded-full border border-foreground/30"
          style={{
            transform: phase >= 1 ? "scale(1)" : "scale(0.2)",
            opacity: phase >= 2 ? 0 : 1,
            transition: "transform 1.2s cubic-bezier(0.16,1,0.3,1) 80ms, opacity 1s ease-out",
          }}
        />
      </div>

      <div className="relative flex flex-col items-center">
        {/* Logo mark — minimalist B&W speech bubble */}
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground text-background shadow-2xl"
          style={{
            transform:
              phase === 0
                ? "translateY(20px) scale(0.8)"
                : phase >= 2
                ? "translateY(-6px) scale(1)"
                : "translateY(0) scale(1)",
            opacity: phase === 0 ? 0 : 1,
            transition: "transform 700ms cubic-bezier(0.16,1,0.3,1), opacity 500ms ease-out",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
            <path
              d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H10l-4 4v-4H7a3 3 0 0 1-3-3V6Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? "translateY(0)" : "translateY(8px)",
            transition: "all 600ms cubic-bezier(0.16,1,0.3,1) 200ms",
            letterSpacing: phase >= 2 ? "-0.02em" : "0.04em",
          }}
        >
          VeltoChat
        </h1>

        {/* Tagline */}
        <p
          className="mt-2 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground"
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? "translateY(0)" : "translateY(6px)",
            transition: "all 600ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          powered by Rey
        </p>

        {/* Loader bar */}
        <div className="mt-8 h-[2px] w-32 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-foreground"
            style={{
              width: phase >= 1 ? "100%" : "0%",
              transition: "width 1400ms cubic-bezier(0.4,0,0.2,1) 100ms",
            }}
          />
        </div>
      </div>
    </div>
  );
};

const SESSION_KEY = "velto:intro:played";

export const shouldPlayIntro = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return true;
  }
};

export const markIntroPlayed = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
};

export const resetIntro = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};

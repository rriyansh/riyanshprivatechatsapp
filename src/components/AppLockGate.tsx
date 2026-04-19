import { useEffect, useState } from "react";
import { Lock, Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isPinSet,
  getMode,
  verifyPin,
  markUnlocked,
  wasRecentlyUnlocked,
  stampBackgroundExit,
  shouldLockAfterBackground,
  clearBackgroundStamp,
} from "@/lib/appLock";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Overlay that blocks the UI when the app is locked.
 * Renders nothing when:
 *   - user is not signed in
 *   - lock mode is "off"
 *   - no PIN is set
 *   - already unlocked this session (mode "open") and not returning from bg
 */
export const AppLockGate = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  // Decide initial lock state on mount / when session appears
  useEffect(() => {
    if (!session) {
      setLocked(false);
      return;
    }
    const mode = getMode();
    if (mode === "off" || !isPinSet()) {
      setLocked(false);
      return;
    }
    // mode "open" or "background": always lock on fresh load unless this tab already unlocked
    if (!wasRecentlyUnlocked()) setLocked(true);
  }, [session?.user?.id]);

  // Background grace handling
  useEffect(() => {
    if (!session) return;

    const onHide = () => {
      if (document.visibilityState === "hidden") stampBackgroundExit();
    };
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      const mode = getMode();
      if (mode !== "background" || !isPinSet()) {
        clearBackgroundStamp();
        return;
      }
      if (shouldLockAfterBackground()) {
        setLocked(true);
        setPin("");
      }
      clearBackgroundStamp();
    };

    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [session?.user?.id]);

  const press = (d: string) => {
    if (busy) return;
    setPin((p) => (p.length >= 6 ? p : p + d));
  };

  const back = () => setPin((p) => p.slice(0, -1));

  // Auto-submit when length reaches 4–6 (try at 4, also try at 6)
  useEffect(() => {
    const tryUnlock = async () => {
      if (pin.length < 4) return;
      setBusy(true);
      const ok = await verifyPin(pin);
      setBusy(false);
      if (ok) {
        markUnlocked();
        setLocked(false);
        setPin("");
      } else if (pin.length >= 6) {
        toast.error("Wrong PIN");
        setPin("");
      }
    };
    if (pin.length === 4 || pin.length === 6) tryUnlock();
    // We intentionally only react to length transitions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!locked) return <>{children}</>;

  return (
    <>
      {children}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)]">
          <Lock className="h-8 w-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">App locked</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your PIN to continue
        </p>

        <div className="mt-8 flex gap-3" aria-label="PIN entry">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full border ${
                i < pin.length
                  ? "border-primary bg-primary"
                  : "border-border bg-transparent"
              }`}
            />
          ))}
        </div>

        <div className="mt-10 grid w-full max-w-xs grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PadButton key={d} onClick={() => press(d)} disabled={busy}>
              {d}
            </PadButton>
          ))}
          <div />
          <PadButton onClick={() => press("0")} disabled={busy}>
            0
          </PadButton>
          <PadButton onClick={back} disabled={busy} aria-label="Delete">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Delete className="h-5 w-5" />
            )}
          </PadButton>
        </div>
      </div>
    </>
  );
};

const PadButton = ({
  children,
  onClick,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button
    type="button"
    variant="ghost"
    onClick={onClick}
    disabled={disabled}
    className="h-16 rounded-2xl text-2xl font-medium"
    {...rest}
  >
    {children}
  </Button>
);

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Shield, ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getMode,
  setMode,
  isPinSet,
  setPin as savePin,
  clearPin,
  verifyPin,
  type LockMode,
  BG_GRACE_SEC,
} from "@/lib/appLock";
import { cn } from "@/lib/utils";

const AppLockSettings = () => {
  const navigate = useNavigate();
  const [mode, setModeState] = useState<LockMode>(getMode());
  const [hasPin, setHasPin] = useState(isPinSet());
  const [showSetup, setShowSetup] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleMode = (m: LockMode) => {
    if (m !== "off" && !hasPin) {
      setShowSetup(true);
      toast.message("Set a PIN first to enable app lock");
      return;
    }
    setMode(m);
    setModeState(m);
    toast.success(
      m === "off"
        ? "App lock disabled"
        : m === "open"
        ? "Locks on app open"
        : `Locks on open and after ${BG_GRACE_SEC}s in background`
    );
  };

  const handleSavePin = async () => {
    if (pin1.length < 4 || pin1.length > 6 || !/^\d+$/.test(pin1)) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    if (pin1 !== pin2) {
      toast.error("PINs don't match");
      return;
    }
    setSaving(true);
    try {
      await savePin(pin1);
      setHasPin(true);
      setShowSetup(false);
      setPin1("");
      setPin2("");
      // Auto-enable "open" mode if it was off
      if (getMode() === "off") {
        setMode("open");
        setModeState("open");
      }
      toast.success("PIN saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePin = async () => {
    if (!oldPin) return;
    setRemoving(true);
    const ok = await verifyPin(oldPin);
    if (!ok) {
      setRemoving(false);
      toast.error("Wrong PIN");
      return;
    }
    clearPin();
    setHasPin(false);
    setModeState("off");
    setOldPin("");
    setRemoving(false);
    toast.success("PIN removed and app lock disabled");
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">App lock</h1>
      </header>

      <div className="space-y-5 px-5 py-5">
        <div className="rounded-3xl glass p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">PIN protection</p>
              <p className="text-xs text-muted-foreground">
                Require a 4–6 digit PIN to open the app.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <ModeRow
              active={mode === "off"}
              onClick={() => handleMode("off")}
              icon={<ShieldOff className="h-4 w-4" />}
              title="Off"
              desc="No lock screen."
            />
            <ModeRow
              active={mode === "open"}
              onClick={() => handleMode("open")}
              icon={<Shield className="h-4 w-4" />}
              title="On app open"
              desc="Locks each time you launch the app."
            />
            <ModeRow
              active={mode === "background"}
              onClick={() => handleMode("background")}
              icon={<Shield className="h-4 w-4" />}
              title="On open + background"
              desc={`Also re-locks after ${BG_GRACE_SEC}s in background.`}
            />
          </div>
        </div>

        {/* PIN management */}
        <div className="rounded-3xl glass p-5">
          {!hasPin || showSetup ? (
            <>
              <p className="mb-3 font-semibold">
                {hasPin ? "Change PIN" : "Set a PIN"}
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pin1">New PIN (4–6 digits)</Label>
                  <Input
                    id="pin1"
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={pin1}
                    onChange={(e) =>
                      setPin1(e.target.value.replace(/\D/g, ""))
                    }
                    className="mt-1 h-12 rounded-xl text-center text-lg tracking-[0.5em]"
                  />
                </div>
                <div>
                  <Label htmlFor="pin2">Confirm PIN</Label>
                  <Input
                    id="pin2"
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={pin2}
                    onChange={(e) =>
                      setPin2(e.target.value.replace(/\D/g, ""))
                    }
                    className="mt-1 h-12 rounded-xl text-center text-lg tracking-[0.5em]"
                  />
                </div>
                <Button
                  onClick={handleSavePin}
                  disabled={saving}
                  className="h-12 w-full rounded-xl"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save PIN"}
                </Button>
                {hasPin && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowSetup(false)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 font-semibold">Your PIN is set</p>
              <Button
                variant="outline"
                onClick={() => setShowSetup(true)}
                className="mb-4 w-full rounded-xl"
              >
                Change PIN
              </Button>

              <div className="border-t border-border pt-4">
                <Label htmlFor="oldpin" className="text-destructive">
                  Remove PIN (disables app lock)
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="oldpin"
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    placeholder="Enter current PIN"
                    value={oldPin}
                    onChange={(e) =>
                      setOldPin(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-11 rounded-xl"
                  />
                  <Button
                    variant="destructive"
                    onClick={handleRemovePin}
                    disabled={removing || oldPin.length < 4}
                    className="rounded-xl"
                  >
                    {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="px-2 text-center text-xs text-muted-foreground">
          PIN is stored only on this device. Biometric (Face ID / fingerprint)
          will unlock automatically when you install the native app.
        </p>
      </div>
    </div>
  );
};

const ModeRow = ({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
      active
        ? "border-primary bg-primary/10"
        : "border-border hover:border-foreground/30"
    )}
  >
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}
    >
      {icon}
    </span>
    <div className="flex-1">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
    <span
      className={cn(
        "h-4 w-4 rounded-full border-2",
        active ? "border-primary bg-primary" : "border-border"
      )}
    />
  </button>
);

export default AppLockSettings;

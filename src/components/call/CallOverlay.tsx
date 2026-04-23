import { useEffect, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, AudioLines } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCall } from "@/components/call/CallProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MiniProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const useProfile = (userId: string | null) => {
  const [p, setP] = useState<MiniProfile | null>(null);
  useEffect(() => {
    if (!userId) {
      setP(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setP((data as MiniProfile) || null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return p;
};

const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
};

export const CallOverlay = () => {
  const {
    status,
    incoming,
    peerId,
    muted,
    speakerOn,
    startedAt,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    switchAudioOutput,
  } = useCall();

  const incomingProfile = useProfile(incoming?.fromUserId ?? null);
  const peerProfile = useProfile(peerId);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "in-call") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  if (incoming) {
    const name = incomingProfile?.display_name || incomingProfile?.username || "Unknown";
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 p-5 backdrop-blur-xl animate-fade-in">
        <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-border bg-card text-center shadow-[var(--shadow-elegant)]">
          <div className="bg-muted/60 px-6 py-8">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Incoming call</p>
            <Avatar className="mx-auto mb-4 mt-4 h-28 w-28 ring-4 ring-primary/15 animate-pulse-ring">
              <AvatarImage src={incomingProfile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-3xl">{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold">{name}</h2>
            {incomingProfile?.username && <p className="mt-1 text-sm text-muted-foreground">@{incomingProfile.username}</p>}
          </div>
          <div className="flex items-center justify-around px-6 py-7">
            <CallButton label="Decline" onClick={rejectCall} danger icon={<PhoneOff className="h-7 w-7" />} />
            <CallButton label="Accept" onClick={acceptCall} success icon={<Phone className="h-7 w-7" />} />
          </div>
        </div>
      </div>
    );
  }

  if (status === "idle") return null;

  const name = peerProfile?.display_name || peerProfile?.username || "Calling…";
  const subtitle =
    status === "ringing-out"
      ? "Ringing…"
      : status === "connecting"
      ? "Connecting…"
      : status === "in-call"
      ? startedAt
        ? fmtDuration(now - startedAt)
        : "Connected"
      : "Call ended";

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-background/98 px-6 py-10 backdrop-blur-xl animate-fade-in">
      <div className="absolute inset-x-10 top-10 h-48 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative flex flex-col items-center text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Voice call</p>
        <Avatar className={cn("mb-5 mt-8 h-36 w-36 ring-4 ring-primary/15 shadow-[var(--shadow-elegant)] transition-transform", status !== "in-call" && "animate-pulse-ring")}>
          <AvatarImage src={peerProfile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-4xl">{name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <h2 className="text-3xl font-bold">{name}</h2>
        <p className="mt-2 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="relative w-full max-w-md rounded-[2rem] border border-border bg-card/90 p-5 shadow-[var(--shadow-elegant)]">
        <div className="grid grid-cols-4 gap-3">
          <ControlButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute} disabled={status !== "in-call"} active={muted} icon={muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} />
          <ControlButton label={speakerOn ? "Speaker" : "Silent"} onClick={toggleSpeaker} disabled={status !== "in-call"} active={speakerOn} icon={speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} />
          <ControlButton
            label="Output"
            onClick={async () => {
              const ok = await switchAudioOutput();
              toast[ok ? "success" : "message"](ok ? "Audio output switched" : "Output switching is not supported here");
            }}
            disabled={status !== "in-call"}
            icon={<AudioLines className="h-5 w-5" />}
          />
          <ControlButton label="End" onClick={() => endCall(true)} danger icon={<PhoneOff className="h-5 w-5" />} />
        </div>
      </div>
    </div>
  );
};

const CallButton = ({ label, icon, onClick, danger, success }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; success?: boolean }) => (
  <div className="flex flex-col items-center gap-2">
    <Button size="icon" onClick={onClick} className={cn("h-16 w-16 rounded-full shadow-lg", danger && "bg-destructive text-destructive-foreground hover:bg-destructive/90", success && "bg-primary text-primary-foreground hover:bg-primary/90")} aria-label={label}>
      {icon}
    </Button>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

const ControlButton = ({ label, icon, onClick, disabled, active, danger }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-background text-xs font-medium transition-all disabled:opacity-45",
      active && "bg-primary text-primary-foreground",
      danger && "bg-destructive text-destructive-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

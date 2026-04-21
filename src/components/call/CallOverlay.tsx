import { useEffect, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCall } from "@/components/call/CallProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
    startedAt,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  } = useCall();

  const incomingProfile = useProfile(incoming?.fromUserId ?? null);
  const peerProfile = useProfile(peerId);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "in-call") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Incoming call sheet
  if (incoming) {
    const name =
      incomingProfile?.display_name || incomingProfile?.username || "Unknown";
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 backdrop-blur-md animate-fade-in">
        <div className="mx-5 w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Incoming voice call
          </p>
          <Avatar className="mx-auto mb-3 mt-4 h-24 w-24 ring-4 ring-foreground/10 animate-pulse-ring">
            <AvatarImage src={incomingProfile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">
              {name[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold">{name}</h2>
          {incomingProfile?.username && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              @{incomingProfile.username}
            </p>
          )}
          <div className="mt-8 flex items-center justify-around">
            <div className="flex flex-col items-center gap-2">
              <Button
                size="icon"
                onClick={rejectCall}
                className="h-16 w-16 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90"
                aria-label="Decline"
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
              <span className="text-xs text-muted-foreground">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Button
                size="icon"
                onClick={acceptCall}
                className="h-16 w-16 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
                aria-label="Accept"
              >
                <Phone className="h-7 w-7" />
              </Button>
              <span className="text-xs text-muted-foreground">Accept</span>
            </div>
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
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-background/98 px-6 py-12 backdrop-blur-xl animate-fade-in">
      <div className="flex flex-col items-center text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Voice call
        </p>
        <Avatar
          className={cn(
            "mb-5 mt-6 h-32 w-32 ring-4 ring-foreground/10 transition-transform",
            status === "ringing-out" && "animate-pulse-ring"
          )}
        >
          <AvatarImage src={peerProfile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-3xl">
            {name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-3xl font-bold">{name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={toggleMute}
            disabled={status !== "in-call"}
            className={cn(
              "h-14 w-14 rounded-full border-foreground/20",
              muted && "bg-foreground text-background hover:bg-foreground/90"
            )}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {muted ? "Unmute" : "Mute"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            onClick={() => endCall(true)}
            className="h-16 w-16 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90"
            aria-label="End call"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
          <span className="text-[11px] text-muted-foreground">End</span>
        </div>
      </div>
    </div>
  );
};

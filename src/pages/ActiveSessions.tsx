import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, Monitor, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentSessionId, clearLocalSessionId } from "@/hooks/useSessionTracking";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Session = {
  id: string;
  device_label: string;
  user_agent: string | null;
  created_at: string;
  last_active_at: string;
};

const ActiveSessions = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const currentId = getCurrentSessionId();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("active_sessions")
      .select("id, device_label, user_agent, created_at, last_active_at")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });
    if (error) toast.error(error.message);
    else setSessions(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const revoke = async (id: string) => {
    setWorking(true);
    const { error } = await supabase.from("active_sessions").delete().eq("id", id);
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Device signed out");
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const logoutEverywhere = async () => {
    if (!user) return;
    setWorking(true);
    const { error } = await supabase.from("active_sessions").delete().eq("user_id", user.id);
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    clearLocalSessionId();
    toast.success("Signed out from every device");
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Active sessions</h1>
          <p className="text-xs text-muted-foreground">Devices currently signed in to your account</p>
        </div>
      </header>

      <div className="space-y-4 px-5 py-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No active sessions tracked yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const isCurrent = s.id === currentId;
              const Icon = /iOS|Android/i.test(s.device_label) ? Smartphone : Monitor;
              return (
                <Card key={s.id} className="rounded-3xl border-border/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{s.device_label}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            This device
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last active {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">{s.user_agent}</p>
                    </div>
                    {!isCurrent && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={working}
                        onClick={() => revoke(s.id)}
                        aria-label="Sign out this device"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Button
          variant="outline"
          disabled={working || sessions.length === 0}
          onClick={logoutEverywhere}
          className="h-12 w-full rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
};

export default ActiveSessions;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RestrictedRow = {
  id: string;
  restricted_id: string;
  profile: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

const RestrictedUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<RestrictedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("restricted_users")
      .select("id, restricted_id")
      .eq("restrictor_id", user.id);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = data.map((r) => r.restricted_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setRows(
      data.map((r) => ({
        id: r.id,
        restricted_id: r.restricted_id,
        profile: byId.get(r.restricted_id)
          ? {
              username: byId.get(r.restricted_id)!.username,
              display_name: byId.get(r.restricted_id)!.display_name,
              avatar_url: byId.get(r.restricted_id)!.avatar_url,
            }
          : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const unrestrict = async (id: string) => {
    setWorking(id);
    const { error } = await supabase.from("restricted_users").delete().eq("id", id);
    setWorking(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("User unrestricted");
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Restricted users</h1>
          <p className="text-xs text-muted-foreground">They can still message you, but won't see your activity</p>
        </div>
      </header>

      <div className="space-y-3 px-5 py-5">
        <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/50 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Restricted users won't see your online status, last seen, typing indicators, or read receipts.
            Their messages will still arrive normally.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            You haven't restricted anyone. Open a chat and use the menu to restrict.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const initial = (r.profile?.display_name || r.profile?.username || "?")[0]?.toUpperCase();
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-3xl border border-border/70 bg-card p-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.profile?.display_name || r.profile?.username || "Unknown"}</p>
                    {r.profile?.username && <p className="truncate text-xs text-muted-foreground">@{r.profile.username}</p>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={working === r.id}
                    onClick={() => unrestrict(r.id)}
                    aria-label="Remove restriction"
                  >
                    {working === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RestrictedUsers;

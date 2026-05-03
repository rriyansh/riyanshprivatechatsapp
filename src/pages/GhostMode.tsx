import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, EyeOff, Loader2, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Ghost = {
  id: string;
  hidden_from_id: string;
  profile: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

type SearchResult = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null };

const sanitize = (s: string) => s.replace(/[%_,()'"\\]/g, "").trim();

const GhostMode = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Ghost[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ghost_targets")
      .select("id, hidden_from_id")
      .eq("user_id", user.id);
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
    const ids = data.map((r) => r.hidden_from_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setRows(
      data.map((r) => ({
        id: r.id,
        hidden_from_id: r.hidden_from_id,
        profile: byId.get(r.hidden_from_id)
          ? {
              username: byId.get(r.hidden_from_id)!.username,
              display_name: byId.get(r.hidden_from_id)!.display_name,
              avatar_url: byId.get(r.hidden_from_id)!.avatar_url,
            }
          : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => {
    const q = sanitize(query);
    if (!q || q.length < 2 || !user) {
      setResults([]);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("user_id", user.id)
        .limit(8);
      setResults((data ?? []) as SearchResult[]);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query, user?.id]);

  const addGhost = async (targetId: string) => {
    if (!user) return;
    setWorking(targetId);
    const { error } = await supabase.from("ghost_targets").insert({ user_id: user.id, hidden_from_id: targetId });
    setWorking(null);
    if (error) {
      toast.error(error.code === "23505" ? "Already hidden from this user" : error.message);
      return;
    }
    toast.success("Hidden from this user");
    setQuery("");
    setResults([]);
    void load();
  };

  const removeGhost = async (id: string) => {
    setWorking(id);
    const { error } = await supabase.from("ghost_targets").delete().eq("id", id);
    setWorking(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Removed from ghost list");
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Ghost mode</h1>
          <p className="text-xs text-muted-foreground">Appear offline to specific people</p>
        </div>
      </header>

      <div className="space-y-4 px-5 py-5">
        <div className="flex items-start gap-3 rounded-3xl border border-border/70 bg-card/50 p-4">
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            People on this list will never see your last seen or online status, no matter your other privacy settings.
          </p>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add someone</p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name…"
            className="h-12 rounded-2xl"
          />
          {searching && <p className="px-1 text-xs text-muted-foreground">Searching…</p>}
          {results.length > 0 && (
            <div className="space-y-1.5 rounded-3xl border border-border/70 bg-card p-2">
              {results.map((r) => {
                const initial = (r.display_name || r.username || "?")[0]?.toUpperCase();
                return (
                  <div key={r.user_id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-accent">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.avatar_url ?? undefined} />
                      <AvatarFallback>{initial}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.display_name || r.username}</p>
                      {r.username && <p className="truncate text-xs text-muted-foreground">@{r.username}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working === r.user_id}
                      onClick={() => addGhost(r.user_id)}
                    >
                      {working === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hidden from</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              No one is on your ghost list.
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
                      onClick={() => removeGhost(r.id)}
                      aria-label="Remove from ghost list"
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
    </div>
  );
};

export default GhostMode;

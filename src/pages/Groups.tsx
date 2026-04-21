import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Users, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { formatDistanceToNowStrict } from "date-fns";

type GroupRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  memberCount: number;
};

const Groups = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Get groups I'm a member of (RLS will filter)
    const { data: memberships, error: mErr } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (mErr) {
      toast.error(mErr.message);
      setLoading(false);
      return;
    }
    const ids = (memberships ?? []).map((m) => m.group_id);
    if (ids.length === 0) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const [{ data: gs, error: gErr }, { data: counts }] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, avatar_url, created_at, updated_at")
        .in("id", ids)
        .order("updated_at", { ascending: false }),
      supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", ids),
    ]);
    if (gErr) {
      toast.error(gErr.message);
    }
    const byGroup = new Map<string, number>();
    (counts ?? []).forEach((r) => {
      byGroup.set(r.group_id, (byGroup.get(r.group_id) || 0) + 1);
    });
    setGroups(
      (gs ?? []).map((g) => ({
        ...g,
        memberCount: byGroup.get(g.id) || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  // Realtime: refresh when membership/groups change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("groups-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col pb-24">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Rooms</h1>
          <p className="text-[11px] text-muted-foreground">Group conversations</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => setShowCreate(true)}
          aria-label="Create group"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </header>

      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms…"
            className="h-11 rounded-2xl bg-background/60 pl-10"
          />
        </div>
      </div>

      <main className="flex-1 px-3 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">No rooms yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a room and invite people to start a group conversation.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-5 h-11 rounded-2xl px-5"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New room
            </Button>
          </div>
        ) : (
          <ul className="space-y-1 animate-fade-in">
            {filtered.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/room/${g.id}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={g.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-foreground text-background">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{g.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(g.updated_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <CreateGroupDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(id) => navigate(`/room/${id}`)}
      />
    </div>
  );
};

export default Groups;

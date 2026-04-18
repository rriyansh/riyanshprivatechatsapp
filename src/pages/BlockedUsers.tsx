import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { unblockUser } from "@/lib/follows";
import { toast } from "sonner";

type Blocked = {
  blocked_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const BlockedUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: blocks } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    const ids = (blocks ?? []).map((b) => b.blocked_id);
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", ids);
    setItems(
      (profs ?? []).map((p) => ({
        blocked_id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const handleUnblock = async (id: string) => {
    if (!user) return;
    try {
      await unblockUser(user.id, id);
      toast.success("Unblocked");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unblock");
    }
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
        <h1 className="text-lg font-semibold">Blocked users</h1>
      </header>

      <div className="px-3 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm rounded-3xl glass px-6 py-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No blocked users</p>
            <p className="mt-1 text-sm text-muted-foreground">
              People you block will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((b) => (
              <li
                key={b.blocked_id}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-accent"
              >
                <Link to={`/u/${b.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={b.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(b.display_name || b.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {b.display_name || b.username}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">@{b.username}</p>
                  </div>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleUnblock(b.blocked_id)}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BlockedUsers;

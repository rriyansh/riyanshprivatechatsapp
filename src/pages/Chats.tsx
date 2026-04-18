import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, MessageSquarePlus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type ConversationPreview = {
  partner: Profile;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

const Chats = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: msgs, error: mErr }, { data: profs, error: pErr }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, type, seen, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .neq("user_id", user.id)
        .limit(200),
    ]);

    if (mErr) toast.error(mErr.message);
    if (pErr) toast.error(pErr.message);

    const profileMap = new Map<string, Profile>();
    (profs || []).forEach((p) => profileMap.set(p.user_id, p));

    const previewFor = (m: { type: string; content: string }) => {
      if (m.type === "image") return "📷 Photo";
      if (m.type === "voice") return "🎤 Voice note";
      return m.content;
    };

    const byPartner = new Map<string, ConversationPreview>();
    (msgs || []).forEach((m) => {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const partner = profileMap.get(partnerId);
      if (!partner) return;
      const existing = byPartner.get(partnerId);
      if (!existing) {
        byPartner.set(partnerId, {
          partner,
          lastMessage: previewFor(m),
          lastAt: m.created_at,
          unread: m.receiver_id === user.id && !m.seen ? 1 : 0,
        });
      } else if (m.receiver_id === user.id && !m.seen) {
        existing.unread += 1;
      }
    });

    setConversations(Array.from(byPartner.values()));
    setAllUsers(profs || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [user?.id]);

  // Realtime: refresh on any new message involving me
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chats-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.partner.username, c.partner.display_name].some((s) => s?.toLowerCase().includes(q))
    );
  }, [conversations, search]);

  const newChatList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter((u) =>
      [u.username, u.display_name].some((s) => s?.toLowerCase().includes(q))
    );
  }, [allUsers, search]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-20 flex items-center justify-between rounded-b-3xl px-5 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
          <p className="text-xs text-muted-foreground">End-to-end private messaging</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={() => setShowNew((v) => !v)}
            aria-label="New chat"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={showNew ? "Search people…" : "Search chats…"}
            className="h-11 rounded-2xl bg-background/60 pl-10"
          />
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 px-3 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : showNew ? (
          <ul className="space-y-1 animate-fade-in">
            {newChatList.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No users found. Invite a friend to sign up.
              </p>
            )}
            {newChatList.map((p) => (
              <li key={p.user_id}>
                <Link
                  to={`/chat/${p.user_id}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(p.display_name || p.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {p.display_name || p.username}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)]">
              <MessageSquarePlus className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-semibold">No conversations yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap the new-chat icon above to start messaging.
            </p>
          </div>
        ) : (
          <ul className="space-y-1 animate-fade-in">
            {filtered.map((c) => (
              <li key={c.partner.user_id}>
                <Link
                  to={`/chat/${c.partner.user_id}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={c.partner.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {(c.partner.display_name || c.partner.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">
                        {c.partner.display_name || c.partner.username}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(c.lastAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-muted-foreground">{c.lastMessage}</p>
                      {c.unread > 0 && (
                        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Chats;

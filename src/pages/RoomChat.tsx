import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Loader2,
  Users,
  Image as ImageIcon,
  LogOut,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { FormattedText } from "@/lib/formatMessage";
import {
  WALLPAPER_PRESETS as _w,
  getWallpaper,
  resolveWallpaperStyle,
} from "@/lib/chatWallpaper";
import { WallpaperDialog } from "@/components/chat/WallpaperDialog";
import { cn } from "@/lib/utils";

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  type: string;
  reply_to_id: string | null;
  deleted_for_everyone: boolean;
  created_at: string;
};

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type GroupInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
};

const RoomChat = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<Map<string, Profile>>(new Map());
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperKey, setWallpaperKey] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  const wallpaper = useMemo(
    () => (groupId ? resolveWallpaperStyle(getWallpaper("group", groupId)) : {}),
    [groupId, wallpaperKey]
  );

  // Load group, members, messages
  useEffect(() => {
    if (!user || !groupId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: g, error: gErr }, { data: ms, error: msErr }, { data: msgs, error: mErr }] =
        await Promise.all([
          supabase
            .from("groups")
            .select("id, name, avatar_url, created_by")
            .eq("id", groupId)
            .maybeSingle(),
          supabase.from("group_members").select("user_id").eq("group_id", groupId),
          supabase
            .from("group_messages")
            .select("*")
            .eq("group_id", groupId)
            .order("created_at", { ascending: true })
            .limit(500),
        ]);
      if (cancelled) return;
      if (gErr) toast.error(gErr.message);
      if (msErr) toast.error(msErr.message);
      if (mErr) toast.error(mErr.message);
      if (!g) {
        setLoading(false);
        toast.error("Room not found");
        navigate("/rooms");
        return;
      }
      setGroup(g as GroupInfo);
      setMessages((msgs || []) as GroupMessage[]);

      // Load member profiles
      const memberIds = (ms || []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", memberIds);
        if (cancelled) return;
        const map = new Map<string, Profile>();
        (profs || []).forEach((p) => map.set(p.user_id, p as Profile));
        setMembers(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, groupId, navigate]);

  // Realtime
  useEffect(() => {
    if (!user || !groupId) return;
    const channel = supabase
      .channel(`room:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const m = payload.new as GroupMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const m = payload.new as GroupMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, groupId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !user || !groupId || sending) return;
    if (content.length > 4000) {
      toast.error("Message too long");
      return;
    }
    setSending(true);
    setText("");
    const { error } = await supabase.from("group_messages").insert({
      group_id: groupId,
      sender_id: user.id,
      content,
      type: "text",
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setText(content);
    }
  };

  const leaveGroup = async () => {
    if (!user || !groupId) return;
    const ok = window.confirm("Leave this room? You'll need to be re-invited to come back.");
    if (!ok) return;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Left the room");
    navigate("/rooms");
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => navigate("/rooms")}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={group?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-foreground text-background">
              <Users className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{group?.name || "…"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {members.size} {members.size === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="Room options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl">
            <DropdownMenuItem onClick={() => setWallpaperOpen(true)}>
              <ImageIcon className="mr-2 h-4 w-4" /> Chat wallpaper
            </DropdownMenuItem>
            <DropdownMenuItem onClick={leaveGroup} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Leave room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div
        ref={scrollRef}
        className="scroll-clean flex-1 overflow-y-auto px-4 py-4"
        style={wallpaper}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <p>No messages yet — say hi 👋</p>
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <div key={day}>
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-muted/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {day}
                </span>
              </div>
              {items.map((m, idx) => {
                const mine = m.sender_id === user?.id;
                const prev = items[idx - 1];
                const isGrouped = !!prev && prev.sender_id === m.sender_id;
                const sender = members.get(m.sender_id);
                const senderName =
                  sender?.display_name || sender?.username || "Unknown";
                return (
                  <div
                    key={m.id}
                    className={cn("mb-1 flex items-end gap-2", mine ? "justify-end" : "justify-start")}
                  >
                    {!mine && (
                      <Avatar
                        className={cn(
                          "h-7 w-7 shrink-0",
                          isGrouped && "invisible"
                        )}
                      >
                        <AvatarImage src={sender?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {senderName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] rounded-3xl px-4 py-2.5 text-[15px] animate-bubble-in",
                        mine
                          ? "bubble-sender rounded-br-md"
                          : "bubble-receiver rounded-bl-md"
                      )}
                    >
                      {!mine && !isGrouped && (
                        <p className="mb-0.5 text-[11px] font-semibold opacity-70">
                          {senderName}
                        </p>
                      )}
                      {m.deleted_for_everyone ? (
                        <span className="italic opacity-60">Message deleted</span>
                      ) : (
                        <FormattedText text={m.content} />
                      )}
                      <p
                        className={cn(
                          "mt-1 text-[10px] opacity-60",
                          mine ? "text-right" : "text-left"
                        )}
                      >
                        {format(new Date(m.created_at), "p")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="glass sticky bottom-0 z-20 rounded-t-3xl px-3 py-3">
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message the room"
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background/70 px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !text.trim()}
            className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)] transition-transform active:scale-95"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>

      {groupId && (
        <WallpaperDialog
          open={wallpaperOpen}
          onOpenChange={setWallpaperOpen}
          type="group"
          id={groupId}
          onChange={() => setWallpaperKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

const groupByDay = (msgs: GroupMessage[]): [string, GroupMessage[]][] => {
  const out = new Map<string, GroupMessage[]>();
  msgs.forEach((m) => {
    const d = new Date(m.created_at);
    const label = isToday(d)
      ? "Today"
      : isYesterday(d)
      ? "Yesterday"
      : format(d, "EEEE, MMM d");
    const arr = out.get(label) || [];
    arr.push(m);
    out.set(label, arr);
  });
  return Array.from(out.entries());
};

export default RoomChat;

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Check, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: string;
  seen: boolean;
  created_at: string;
};

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen: string | null;
};

const Chat = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<number | undefined>();

  const channelName = useMemo(() => {
    if (!user || !partnerId) return "";
    const [a, b] = [user.id, partnerId].sort();
    return `dm:${a}:${b}`;
  }, [user?.id, partnerId]);

  // Load partner profile + messages
  useEffect(() => {
    if (!user || !partnerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: prof, error: pErr }, { data: msgs, error: mErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, last_seen")
          .eq("user_id", partnerId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true })
          .limit(500),
      ]);
      if (cancelled) return;
      if (pErr) toast.error(pErr.message);
      if (mErr) toast.error(mErr.message);
      setPartner(prof || null);
      setMessages(msgs || []);
      setLoading(false);

      // Mark received messages as seen
      const unseenIds = (msgs || [])
        .filter((m) => m.receiver_id === user.id && !m.seen)
        .map((m) => m.id);
      if (unseenIds.length > 0) {
        await supabase.from("messages").update({ seen: true }).in("id", unseenIds);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, partnerId]);

  // Realtime: messages + typing presence/broadcast
  useEffect(() => {
    if (!user || !partnerId || !channelName) return;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false }, presence: { key: user.id } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          // Only messages between us
          const involvesPair =
            (m.sender_id === user.id && m.receiver_id === partnerId) ||
            (m.sender_id === partnerId && m.receiver_id === user.id);
          if (!involvesPair) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          // Mark as seen if it's incoming
          if (m.receiver_id === user.id && !m.seen) {
            supabase.from("messages").update({ seen: true }).eq("id", m.id).then(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === partnerId) {
          setPartnerTyping(true);
          window.clearTimeout(typingTimeout.current);
          typingTimeout.current = window.setTimeout(() => setPartnerTyping(false), 2500);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      window.clearTimeout(typingTimeout.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, user?.id, partnerId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, partnerTyping]);

  const handleTyping = (value: string) => {
    setText(value);
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user?.id },
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !user || !partnerId || sending) return;
    if (content.length > 4000) {
      toast.error("Message too long (max 4000 characters)");
      return;
    }
    setSending(true);
    setText("");
    const optimistic: Message = {
      id: `temp-${crypto.randomUUID()}`,
      sender_id: user.id,
      receiver_id: partnerId,
      content,
      type: "text",
      seen: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: partnerId,
        content,
        type: "text",
      })
      .select("*")
      .single();

    setSending(false);
    if (error) {
      toast.error(error.message);
      // rollback
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(content);
      return;
    }
    // Replace optimistic with real
    setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as Message) : m)));
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col">
      {/* Header */}
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
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={partner?.avatar_url ?? undefined} />
            <AvatarFallback>
              {(partner?.display_name || partner?.username || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {partner?.display_name || partner?.username || "…"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {partnerTyping
                ? "typing…"
                : partner?.last_seen
                ? `last seen ${format(new Date(partner.last_seen), "p")}`
                : "@" + (partner?.username || "")}
            </p>
          </div>
        </Link>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-clean flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <p>Say hi 👋</p>
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
                const grouped = prev && prev.sender_id === m.sender_id;
                return (
                  <div
                    key={m.id}
                    className={`mb-1 flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] animate-bubble-in rounded-3xl px-4 py-2 text-[15px] leading-snug ${
                        mine ? "bubble-sender rounded-br-md" : "bubble-receiver rounded-bl-md"
                      } ${grouped ? "mt-0.5" : "mt-2"}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        <span>{format(new Date(m.created_at), "p")}</span>
                        {mine &&
                          (m.seen ? (
                            <CheckCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {partnerTyping && (
          <div className="mb-2 flex justify-start">
            <div className="bubble-receiver flex items-center gap-1 rounded-3xl rounded-bl-md px-4 py-3">
              <span className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="glass sticky bottom-0 z-20 flex items-end gap-2 rounded-t-3xl px-3 py-3"
      >
        <textarea
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message"
          rows={1}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background/70 px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || sending}
          className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)] transition-transform active:scale-95 disabled:opacity-50"
          aria-label="Send"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </form>
    </div>
  );
};

const groupByDay = (msgs: Message[]): [string, Message[]][] => {
  const out = new Map<string, Message[]>();
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

export default Chat;

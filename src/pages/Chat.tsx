import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Loader2,
  Share2,
  Phone,
  MoreVertical,
  Image as ImageIcon,
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
import { useMyProfile } from "@/hooks/useMyProfile";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ImageAttachButton } from "@/components/chat/ImageAttachButton";
import { ImagePreviewDialog } from "@/components/chat/ImagePreviewDialog";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { compressImage } from "@/lib/imageCompression";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import {
  MessageActionsSheet,
  type MessageAction,
} from "@/components/chat/MessageActionsSheet";
import {
  ReplyComposerPreview,
  type ReplyTarget,
} from "@/components/chat/ReplyPreview";
import {
  ForwardDialog,
  type ForwardPayload,
} from "@/components/chat/ForwardDialog";
import { useReactions } from "@/hooks/useReactions";
import { WallpaperDialog } from "@/components/chat/WallpaperDialog";
import { getWallpaper, resolveWallpaperStyle } from "@/lib/chatWallpaper";
import { useCall } from "@/components/call/CallProvider";

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen: string | null;
};

const MAX_IMAGE_MB = 10;
const MAX_VOICE_MB = 5;

const Chat = () => {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const { profile: myProfile } = useMyProfile();
  const navigate = useNavigate();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageSending, setImageSending] = useState(false);

  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [forwardPayload, setForwardPayload] = useState<ForwardPayload | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<number | undefined>();

  const channelName = useMemo(() => {
    if (!user || !partnerId) return "";
    const [a, b] = [user.id, partnerId].sort();
    return `dm:${a}:${b}`;
  }, [user?.id, partnerId]);

  const partnerName =
    partner?.display_name || partner?.username || "User";
  const myName = myProfile?.display_name || myProfile?.username || "You";

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
      setMessages((msgs || []) as ChatMessage[]);
      setLoading(false);

      // Mark anything sent to me as delivered (if not already) and seen on open
      const undeliveredIds = (msgs || [])
        .filter((m) => m.receiver_id === user.id && !m.delivered_at)
        .map((m) => m.id);
      if (undeliveredIds.length > 0) {
        await supabase
          .from("messages")
          .update({ delivered_at: new Date().toISOString() })
          .in("id", undeliveredIds);
      }
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

  // Realtime
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
          const m = payload.new as ChatMessage;
          const involvesPair =
            (m.sender_id === user.id && m.receiver_id === partnerId) ||
            (m.sender_id === partnerId && m.receiver_id === user.id);
          if (!involvesPair) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.receiver_id === user.id) {
            // Mark delivered immediately, then seen since chat is open
            supabase
              .from("messages")
              .update({
                delivered_at: m.delivered_at ?? new Date().toISOString(),
                seen: true,
              })
              .eq("id", m.id)
              .then(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as ChatMessage;
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

  const buildReplyTarget = (m: ChatMessage): ReplyTarget => ({
    id: m.id,
    authorName: m.sender_id === user?.id ? myName : partnerName,
    type: m.type,
    content: m.content,
  });

  const handleSendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !user || !partnerId || sending) return;
    if (content.length > 4000) {
      toast.error("Message too long (max 4000 characters)");
      return;
    }
    setSending(true);
    setText("");
    const replyId = replyTarget?.id ?? null;
    setReplyTarget(null);

    const optimistic: ChatMessage = {
      id: `temp-${crypto.randomUUID()}`,
      sender_id: user.id,
      receiver_id: partnerId,
      content,
      type: "text",
      seen: false,
      created_at: new Date().toISOString(),
      media_path: null,
      media_duration_ms: null,
      reply_to_id: replyId,
      deleted_for_sender: false,
      deleted_for_everyone: false,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: partnerId,
        content,
        type: "text",
        reply_to_id: replyId,
      })
      .select("*")
      .single();

    setSending(false);
    if (error) {
      toast.error(error.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(content);
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === optimistic.id ? (data as ChatMessage) : m))
    );
  };

  const handlePickImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Image is too large (max ${MAX_IMAGE_MB}MB).`);
      return;
    }
    setPendingImage(file);
  };

  const sendImage = async () => {
    if (!pendingImage || !user || !partnerId) return;
    setImageSending(true);
    try {
      const { blob, ext, mime } = await compressImage(pendingImage, {
        maxDim: 1600,
        quality: 0.82,
      });
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const replyId = replyTarget?.id ?? null;
      setReplyTarget(null);

      const { error: insErr } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: partnerId,
        content: "",
        type: "image",
        media_path: path,
        reply_to_id: replyId,
      });
      if (insErr) {
        await supabase.storage.from("chat-media").remove([path]);
        throw insErr;
      }
      setPendingImage(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send image";
      toast.error(msg);
    } finally {
      setImageSending(false);
    }
  };

  const sendVoice = async (blob: Blob, durationMs: number, mime: string) => {
    if (!user || !partnerId) return;
    if (blob.size > MAX_VOICE_MB * 1024 * 1024) {
      toast.error(`Voice note is too large (max ${MAX_VOICE_MB}MB).`);
      return;
    }
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, blob, { contentType: mime, upsert: false });
    if (upErr) throw upErr;

    const replyId = replyTarget?.id ?? null;
    setReplyTarget(null);

    const { error: insErr } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: partnerId,
      content: "",
      type: "voice",
      media_path: path,
      media_duration_ms: Math.round(durationMs),
      reply_to_id: replyId,
    });
    if (insErr) {
      await supabase.storage.from("chat-media").remove([path]);
      throw insErr;
    }
  };

  const scrollToOriginal = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-3xl");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "rounded-3xl");
    }, 1400);
  };

  const handleAction = async (a: MessageAction) => {
    const m = actionTarget;
    setActionTarget(null);
    if (!m || !user) return;

    if (a === "reply") {
      setReplyTarget(buildReplyTarget(m));
      return;
    }
    if (a === "copy") {
      try {
        await navigator.clipboard.writeText(m.content);
        toast.success("Copied");
      } catch {
        toast.error("Could not copy");
      }
      return;
    }
    if (a === "forward") {
      setForwardPayload({
        content: m.content,
        type: m.type,
        media_path: m.media_path,
        media_duration_ms: m.media_duration_ms,
      });
      return;
    }
    if (a === "delete-me") {
      // Hide locally only — keep DB row; we mark deleted_for_sender only if it's mine
      if (m.sender_id === user.id) {
        const { error } = await supabase
          .from("messages")
          .update({ deleted_for_sender: true })
          .eq("id", m.id);
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      toast.success("Deleted for you");
      return;
    }
    if (a === "delete-everyone") {
      if (m.sender_id !== user.id) return;
      const { error } = await supabase
        .from("messages")
        .update({ deleted_for_everyone: true, content: "", media_path: null })
        .eq("id", m.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Deleted for everyone");
    }
  };

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) => !(m.sender_id === user?.id && m.deleted_for_sender)
      ),
    [messages, user?.id]
  );

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const grouped = useMemo(() => groupByDay(visibleMessages), [visibleMessages]);

  const visibleIds = useMemo(() => visibleMessages.map((m) => m.id), [visibleMessages]);
  const { byMessage: reactionsByMessage, toggle: toggleReaction } = useReactions(
    visibleIds,
    partnerId
  );
  const myReactedForActionTarget = useMemo(() => {
    if (!actionTarget || !user) return new Set<string>();
    return new Set(
      (reactionsByMessage[actionTarget.id] || [])
        .filter((r) => r.user_id === user.id)
        .map((r) => r.emoji)
    );
  }, [actionTarget, reactionsByMessage, user]);

  const copyShareLink = async () => {
    if (!myProfile?.username) return;
    const url = `${window.location.origin}/pc/${myProfile.username}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Your share link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

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
        <Link
          to={partner?.username ? `/u/${partner.username}` : "/"}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
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
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={copyShareLink}
          aria-label="Copy your share link"
          title="Copy your share link"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-clean flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visibleMessages.length === 0 ? (
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
                const isGrouped = !!prev && prev.sender_id === m.sender_id;
                const replyTo = m.reply_to_id
                  ? messageMap.get(m.reply_to_id) ?? null
                  : null;
                return (
                  <div key={m.id} id={`msg-${m.id}`} className="transition-shadow">
                    <MessageBubble
                      m={m}
                      mine={mine}
                      isGrouped={isGrouped}
                      replyTo={replyTo}
                      partnerName={partnerName}
                      myName={myName}
                      reactions={reactionsByMessage[m.id] || []}
                      myUserId={user?.id}
                      onReply={(msg) => setReplyTarget(buildReplyTarget(msg))}
                      onLongPress={(msg) => setActionTarget(msg)}
                      onScrollToOriginal={scrollToOriginal}
                      onToggleReaction={toggleReaction}
                    />
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
      <div className="glass sticky bottom-0 z-20 rounded-t-3xl px-3 py-3">
        {replyTarget && (
          <ReplyComposerPreview
            target={replyTarget}
            onClear={() => setReplyTarget(null)}
          />
        )}
        <form onSubmit={handleSendText} className="flex items-end gap-2">
          <ImageAttachButton onPick={handlePickImage} disabled={sending} />
          <textarea
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            placeholder="Message"
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background/70 px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
          />
          {text.trim() ? (
            <Button
              type="submit"
              size="icon"
              disabled={sending}
              className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)] transition-transform active:scale-95"
              aria-label="Send"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          ) : (
            <VoiceRecorder onSend={sendVoice} disabled={sending} />
          )}
        </form>
      </div>

      <ImagePreviewDialog
        file={pendingImage}
        onCancel={() => setPendingImage(null)}
        onSend={sendImage}
        sending={imageSending}
      />

      <MessageActionsSheet
        open={!!actionTarget}
        onOpenChange={(v) => !v && setActionTarget(null)}
        mine={actionTarget?.sender_id === user?.id}
        hasText={
          !!actionTarget && actionTarget.type === "text" && !!actionTarget.content
        }
        myReactedEmojis={myReactedForActionTarget}
        onReact={(emoji) => {
          if (actionTarget) toggleReaction(actionTarget.id, emoji);
        }}
        onAction={handleAction}
      />

      <ForwardDialog
        open={!!forwardPayload}
        onOpenChange={(v) => !v && setForwardPayload(null)}
        payload={forwardPayload}
      />
    </div>
  );
};

const groupByDay = (msgs: ChatMessage[]): [string, ChatMessage[]][] => {
  const out = new Map<string, ChatMessage[]>();
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

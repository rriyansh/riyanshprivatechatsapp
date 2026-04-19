import { useRef, useState, useCallback } from "react";
import { Check, CheckCheck, Reply as ReplyIcon } from "lucide-react";
import { format } from "date-fns";
import { ImageBubble, VoiceBubble } from "@/components/chat/MediaMessage";
import { InlineReplyChip } from "@/components/chat/ReplyPreview";

export type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: string;
  seen: boolean;
  created_at: string;
  media_path: string | null;
  media_duration_ms: number | null;
  reply_to_id: string | null;
  deleted_for_sender: boolean;
  deleted_for_everyone: boolean;
};

const SWIPE_TRIGGER = 60;
const SWIPE_MAX = 90;
const LONG_PRESS_MS = 450;

export const MessageBubble = ({
  m,
  mine,
  isGrouped,
  replyTo,
  partnerName,
  myName,
  onReply,
  onLongPress,
  onScrollToOriginal,
}: {
  m: ChatMessage;
  mine: boolean;
  isGrouped: boolean;
  replyTo: ChatMessage | null;
  partnerName: string;
  myName: string;
  onReply: (m: ChatMessage) => void;
  onLongPress: (m: ChatMessage) => void;
  onScrollToOriginal: (id: string) => void;
}) => {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const moved = useRef(false);
  const longPressTimer = useRef<number | undefined>();

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  };

  const isDeletedForEveryone = m.deleted_for_everyone;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX.current = e.clientX;
      startY.current = e.clientY;
      moved.current = false;
      clearLongPress();
      longPressTimer.current = window.setTimeout(() => {
        if (!moved.current && !isDeletedForEveryone) {
          if (navigator.vibrate) navigator.vibrate(15);
          onLongPress(m);
        }
      }, LONG_PRESS_MS);
    },
    [m, onLongPress, isDeletedForEveryone]
  );

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      moved.current = true;
      clearLongPress();
    }
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (isDeletedForEveryone) return;
    // Swipe right for received messages, left for sent — both reveal reply hint
    const direction = mine ? Math.min(0, dx) : Math.max(0, dx);
    const clamped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, direction));
    setDragX(clamped);
  };

  const onPointerUp = () => {
    clearLongPress();
    if (Math.abs(dragX) >= SWIPE_TRIGGER && !isDeletedForEveryone) {
      onReply(m);
    }
    setDragX(0);
    startX.current = null;
    startY.current = null;
  };

  const onPointerCancel = () => {
    clearLongPress();
    setDragX(0);
    startX.current = null;
    startY.current = null;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (isDeletedForEveryone) return;
    e.preventDefault();
    onLongPress(m);
  };

  const replyAuthor = replyTo
    ? replyTo.sender_id === m.sender_id
      ? mine
        ? myName
        : partnerName
      : mine
      ? partnerName
      : myName
    : "";

  return (
    <div
      className={`relative mb-1 flex ${mine ? "justify-end" : "justify-start"}`}
      style={{ touchAction: "pan-y" }}
    >
      {/* Reply hint icon revealed on swipe */}
      {dragX !== 0 && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
            mine ? "right-2" : "left-2"
          }`}
        >
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 transition-opacity ${
              Math.abs(dragX) >= SWIPE_TRIGGER ? "opacity-100" : "opacity-50"
            }`}
          >
            <ReplyIcon className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 ? "transform 180ms ease-out" : "none",
        }}
        className={`max-w-[78%] animate-bubble-in select-none rounded-3xl text-[15px] leading-snug ${
          mine ? "bubble-sender rounded-br-md" : "bubble-receiver rounded-bl-md"
        } ${isGrouped ? "mt-0.5" : "mt-2"} ${
          m.type === "image" && !isDeletedForEveryone ? "p-1" : "px-4 py-2"
        }`}
      >
        {isDeletedForEveryone ? (
          <p className="italic opacity-70">🚫 This message was deleted</p>
        ) : (
          <>
            {replyTo && (
              <InlineReplyChip
                authorName={replyAuthor}
                type={replyTo.type}
                content={replyTo.content}
                mine={mine}
                onClick={() => onScrollToOriginal(replyTo.id)}
              />
            )}
            {m.type === "image" && m.media_path ? (
              <ImageBubble path={m.media_path} />
            ) : m.type === "voice" && m.media_path ? (
              <VoiceBubble
                path={m.media_path}
                durationMs={m.media_duration_ms}
                mine={mine}
              />
            ) : (
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            )}
          </>
        )}
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            mine ? "text-primary-foreground/80" : "text-muted-foreground"
          } ${m.type === "image" && !isDeletedForEveryone ? "px-2 pb-1" : ""}`}
        >
          <span>{format(new Date(m.created_at), "p")}</span>
          {mine && !isDeletedForEveryone &&
            (m.seen ? (
              <CheckCheck className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            ))}
        </div>
      </div>
    </div>
  );
};

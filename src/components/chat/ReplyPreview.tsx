import { X, Reply as ReplyIcon, Image as ImageIcon, Mic } from "lucide-react";

export type ReplyTarget = {
  id: string;
  authorName: string;
  type: string;
  content: string;
};

export const ReplyComposerPreview = ({
  target,
  onClear,
}: {
  target: ReplyTarget;
  onClear: () => void;
}) => {
  const preview =
    target.type === "image"
      ? "Photo"
      : target.type === "voice"
      ? "Voice message"
      : target.content;
  const Icon =
    target.type === "image" ? ImageIcon : target.type === "voice" ? Mic : ReplyIcon;
  return (
    <div className="mx-1 mb-2 flex items-center gap-3 rounded-xl border-l-4 border-primary bg-muted/60 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-primary">
          Replying to {target.authorName}
        </p>
        <p className="truncate text-xs text-muted-foreground">{preview}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-1 text-muted-foreground hover:bg-background/60"
        aria-label="Cancel reply"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const InlineReplyChip = ({
  authorName,
  type,
  content,
  mine,
  onClick,
}: {
  authorName: string;
  type: string;
  content: string;
  mine: boolean;
  onClick: () => void;
}) => {
  const preview =
    type === "image" ? "📷 Photo" : type === "voice" ? "🎤 Voice message" : content;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 block w-full rounded-xl border-l-4 px-2.5 py-1.5 text-left text-xs ${
        mine
          ? "border-primary-foreground/70 bg-primary-foreground/15 text-primary-foreground/90"
          : "border-primary bg-background/40 text-foreground/80"
      }`}
    >
      <p className="truncate font-semibold">{authorName}</p>
      <p className="truncate opacity-80">{preview || "Message"}</p>
    </button>
  );
};

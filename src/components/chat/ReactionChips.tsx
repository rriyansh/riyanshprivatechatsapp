import { cn } from "@/lib/utils";
import type { Reaction } from "@/hooks/useReactions";

export const ReactionChips = ({
  reactions,
  myUserId,
  mine,
  onToggle,
}: {
  reactions: Reaction[];
  myUserId?: string;
  mine: boolean;
  onToggle: (emoji: string) => void;
}) => {
  if (!reactions || reactions.length === 0) return null;

  // Aggregate by emoji
  const counts = new Map<string, { count: number; mineReacted: boolean }>();
  reactions.forEach((r) => {
    const cur = counts.get(r.emoji) || { count: 0, mineReacted: false };
    cur.count += 1;
    if (r.user_id === myUserId) cur.mineReacted = true;
    counts.set(r.emoji, cur);
  });

  return (
    <div
      className={cn(
        "-mt-1 mb-1 flex flex-wrap gap-1",
        mine ? "justify-end" : "justify-start"
      )}
    >
      {Array.from(counts.entries()).map(([emoji, { count, mineReacted }]) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(emoji);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] backdrop-blur transition-all",
            mineReacted
              ? "border-primary/40 bg-primary/15 text-foreground"
              : "border-border bg-background/70 text-muted-foreground hover:bg-accent"
          )}
          aria-label={`${emoji} ${count}`}
        >
          <span className="text-[14px] leading-none">{emoji}</span>
          {count > 1 && <span className="text-[11px]">{count}</span>}
        </button>
      ))}
    </div>
  );
};

import { REACTION_EMOJIS } from "@/hooks/useReactions";

export const ReactionBar = ({
  myReactedEmojis,
  onPick,
}: {
  myReactedEmojis: Set<string>;
  onPick: (emoji: string) => void;
}) => {
  return (
    <div className="mb-3 flex items-center justify-center gap-1.5 rounded-full bg-muted/60 p-1.5 backdrop-blur">
      {REACTION_EMOJIS.map((e) => {
        const active = myReactedEmojis.has(e);
        return (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform active:scale-90 ${
              active ? "scale-110 bg-primary/15" : "hover:bg-accent"
            }`}
            aria-label={`React with ${e}`}
          >
            {e}
          </button>
        );
      })}
    </div>
  );
};

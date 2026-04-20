import { Reply, Forward, Copy, Trash2, Trash } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReactionBar } from "@/components/chat/ReactionBar";

export type MessageAction =
  | "reply"
  | "forward"
  | "copy"
  | "delete-me"
  | "delete-everyone";

export const MessageActionsSheet = ({
  open,
  onOpenChange,
  mine,
  hasText,
  myReactedEmojis,
  onReact,
  onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mine: boolean;
  hasText: boolean;
  myReactedEmojis: Set<string>;
  onReact: (emoji: string) => void;
  onAction: (a: MessageAction) => void;
}) => {
  const Item = ({
    icon: Icon,
    label,
    danger,
    onClick,
  }: {
    icon: typeof Reply;
    label: string;
    danger?: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-[15px] transition-colors hover:bg-muted/60 ${
        danger ? "text-destructive" : ""
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-6">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-center text-sm font-normal text-muted-foreground">
            Message options
          </SheetTitle>
        </SheetHeader>
        <ReactionBar
          myReactedEmojis={myReactedEmojis}
          onPick={(e) => {
            onReact(e);
            onOpenChange(false);
          }}
        />
        <div className="space-y-1">
          <Item icon={Reply} label="Reply" onClick={() => onAction("reply")} />
          <Item
            icon={Forward}
            label="Forward"
            onClick={() => onAction("forward")}
          />
          {hasText && (
            <Item icon={Copy} label="Copy" onClick={() => onAction("copy")} />
          )}
          <Item
            icon={Trash2}
            label="Delete for me"
            danger
            onClick={() => onAction("delete-me")}
          />
          {mine && (
            <Item
              icon={Trash}
              label="Delete for everyone"
              danger
              onClick={() => onAction("delete-everyone")}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

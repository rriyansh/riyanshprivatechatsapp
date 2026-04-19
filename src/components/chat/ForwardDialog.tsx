import { useEffect, useState } from "react";
import { Loader2, Search, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ForwardPayload = {
  content: string;
  type: string;
  media_path: string | null;
  media_duration_ms: number | null;
};

type Recipient = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export const ForwardDialog = ({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: ForwardPayload | null;
}) => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q || !user) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .neq("user_id", user.id)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      if (!error) setResults((data || []) as Recipient[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, user?.id]);

  const send = async (r: Recipient) => {
    if (!payload || !user) return;
    setSendingId(r.user_id);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: r.user_id,
      content: payload.content,
      type: payload.type,
      media_path: payload.media_path,
      media_duration_ms: payload.media_duration_ms,
    });
    setSendingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Forwarded to ${r.display_name || r.username}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Forward to…</DialogTitle>
        </DialogHeader>
        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or name"
              className="h-11 rounded-xl pl-9"
            />
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-2 py-3">
          {searching && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && query && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No users found
            </p>
          )}
          {!searching && !query && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Type a username to find someone
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.user_id}
              onClick={() => send(r)}
              disabled={sendingId === r.user_id}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={r.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(r.display_name || r.username || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.display_name || r.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{r.username}
                </p>
              </div>
              {sendingId === r.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Send className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

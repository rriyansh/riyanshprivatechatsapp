import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export const CreateGroupDialog = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (groupId: string) => void;
}) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .neq("user_id", user.id)
      .limit(200)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setPeople(data || []);
        setLoading(false);
      });
  }, [open, user?.id]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setName("");
      setSelected(new Set());
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      [p.username, p.display_name].some((s) => s?.toLowerCase().includes(q))
    );
  }, [people, search]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const create = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      toast.error("Room name must be 1–60 characters");
      return;
    }
    if (selected.size === 0) {
      toast.error("Add at least one member");
      return;
    }
    setCreating(true);
    const groupId = crypto.randomUUID();
    const { error } = await supabase
      .from("groups")
      .insert({ id: groupId, name: trimmed, created_by: user.id });
    if (error) {
      setCreating(false);
      toast.error(error.message || "Failed to create room");
      return;
    }
    // Trigger added creator as admin. Now add the rest as members.
    const rows = Array.from(selected).map((uid) => ({
      group_id: groupId,
      user_id: uid,
      role: "member" as const,
    }));
    const { error: mErr } = await supabase.from("group_members").insert(rows);
    if (mErr) {
      // Group created but adding members failed — surface error and still navigate
      toast.error(`Room created but couldn't add members: ${mErr.message}`);
    } else {
      toast.success("Room created");
    }
    setCreating(false);
    onOpenChange(false);
    onCreated?.(groupId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Create a room</DialogTitle>
          <DialogDescription>
            Name your room and pick people to add. You can add more later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name"
            maxLength={60}
            className="h-11 rounded-2xl"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="h-11 rounded-2xl"
          />
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-border">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No people found.
              </p>
            ) : (
              <ul>
                {filtered.map((p) => {
                  const checked = selected.has(p.user_id);
                  return (
                    <li key={p.user_id}>
                      <button
                        type="button"
                        onClick={() => toggle(p.user_id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent",
                          checked && "bg-accent"
                        )}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {(p.display_name || p.username || "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {p.display_name || p.username}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{p.username}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            checked
                              ? "border-foreground bg-foreground text-background"
                              : "border-border"
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-2xl">
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={creating || !name.trim() || selected.size === 0}
            className="rounded-2xl"
          >
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

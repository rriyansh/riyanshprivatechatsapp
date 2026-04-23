import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, RotateCcw, Check, Trash2, Users, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import {
  WALLPAPER_PRESETS,
  clearWallpaper,
  fileToDataURL,
  getWallpaper,
  setWallpaper,
  resolveWallpaperStyle,
} from "@/lib/chatWallpaper";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MAX_MB = 4;

export const WallpaperDialog = ({
  open,
  onOpenChange,
  type,
  id,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: "dm" | "group";
  id: string;
  onChange: (newValue: string | null) => void;
}) => {
  const { user } = useAuth();
  const [current, setCurrent] = useState<string | null>(() => getWallpaper(type, id));
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCurrent(getWallpaper(type, id));
      setPending(null);
    }
  }, [open, type, id]);

  const pair = () => {
    if (!user || type !== "dm") return null;
    const [user_a, user_b] = [user.id, id].sort();
    return { user_a, user_b };
  };

  const applyLocal = (value: string | null) => {
    if (!value) clearWallpaper(type, id);
    else setWallpaper(type, id, value);
    setCurrent(value);
    setPending(null);
    onChange(value);
  };

  const applyBoth = async (value: string | null) => {
    if (!user || type !== "dm") return applyLocal(value);
    const ordered = pair();
    if (!ordered) return;
    setBusy(true);
    try {
      if (!value) {
        const { error } = await supabase
          .from("shared_chat_wallpapers" as never)
          .delete()
          .eq("user_a", ordered.user_a)
          .eq("user_b", ordered.user_b);
        if (error) throw error;
        applyLocal(null);
        toast.success("Wallpaper removed for both users");
      } else {
        const { error } = await supabase.from("shared_chat_wallpapers" as never).upsert(
          {
            ...ordered,
            wallpaper_data: value,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "user_a,user_b" }
        );
        if (error) throw error;
        applyLocal(value);
        toast.success("Wallpaper synced for both users");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync wallpaper");
    } finally {
      setBusy(false);
    }
  };

  const choose = (value: string | null) => {
    setPending(value);
    setCurrent(value);
  };

  const resetLocal = () => {
    applyLocal(null);
    toast.success("Wallpaper reset for you");
  };

  const onPick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image too large (max ${MAX_MB}MB).`);
      return;
    }
    setBusy(true);
    try {
      const { blob } = await compressImage(file, { maxDim: 1400, quality: 0.78 });
      const dataUrl = await fileToDataURL(new File([blob], file.name));
      choose(dataUrl);
      toast.success("Preview ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Change wallpaper</DialogTitle>
          <DialogDescription>
            Store it for this chat only, or sync it for both users.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-28 overflow-hidden rounded-2xl border border-border bg-muted" style={resolveWallpaperStyle(current)}>
          <div className="flex min-h-28 items-center justify-center bg-background/35 p-4 text-center backdrop-blur-[1px]">
            <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
              Live preview
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {WALLPAPER_PRESETS.map((p) => {
            const value = p.id === "default" ? null : `preset:${p.id}`;
            const active =
              (value === null && (current === null || current === "preset:default")) ||
              current === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => choose(value)}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border transition-all hover:scale-[1.02]"
                style={resolveWallpaperStyle(value)}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 text-[11px] font-medium backdrop-blur">
                  {p.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="group flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <ImageIcon className="h-6 w-6" />
            <span className="text-[11px] font-medium">From device</span>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />

        {pending !== null || current === null ? (
          <div className="grid grid-cols-2 gap-2 rounded-3xl border border-border bg-card p-2">
            <Button variant="outline" onClick={() => applyLocal(current)} disabled={busy} className="rounded-2xl">
              <User className="mr-1.5 h-4 w-4" /> Apply for me
            </Button>
            <Button onClick={() => applyBoth(current)} disabled={busy || type !== "dm"} className="rounded-2xl">
              {busy ? <RotateCcw className="mr-1.5 h-4 w-4 animate-spin" /> : <Users className="mr-1.5 h-4 w-4" />}
              Apply for both
            </Button>
          </div>
        ) : null}

        <div className="flex justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={resetLocal} className="rounded-2xl">
            <RotateCcw className="mr-1.5 h-4 w-4" /> Reset mine
          </Button>
          <div className="flex gap-2">
            {current && (
              <Button variant="outline" onClick={() => applyBoth(null)} disabled={busy || type !== "dm"} className="rounded-2xl">
                <Trash2 className="mr-1.5 h-4 w-4" /> Remove both
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)} className="rounded-2xl">Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

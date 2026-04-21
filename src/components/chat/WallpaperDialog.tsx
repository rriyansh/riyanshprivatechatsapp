import { useRef, useState } from "react";
import { Image as ImageIcon, RotateCcw, Check } from "lucide-react";
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
  const [current, setCurrent] = useState<string | null>(() => getWallpaper(type, id));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const choose = (value: string | null) => {
    if (!value) {
      clearWallpaper(type, id);
    } else {
      setWallpaper(type, id, value);
    }
    setCurrent(value);
    onChange(value);
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
      toast.success("Wallpaper updated");
      onOpenChange(false);
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
          <DialogTitle>Chat wallpaper</DialogTitle>
          <DialogDescription>
            Stored on this device only. Each chat can have its own.
          </DialogDescription>
        </DialogHeader>

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

          {/* Custom upload */}
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

        <div className="flex justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={() => {
              choose(null);
              toast.success("Wallpaper reset");
            }}
            className="rounded-2xl"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={() => onOpenChange(false)} className="rounded-2xl">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from "react";
import { Loader2, Play, Pause, ImageOff } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSignedUrl } from "@/hooks/useSignedUrls";

export const ImageBubble = ({ path }: { path: string }) => {
  const url = useSignedUrl(path);
  const [open, setOpen] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!url) {
    return (
      <div className="flex h-44 w-56 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (errored) {
    return (
      <div className="flex h-44 w-56 flex-col items-center justify-center gap-2 rounded-2xl bg-black/5 text-muted-foreground dark:bg-white/5">
        <ImageOff className="h-5 w-5" />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-2xl"
      >
        <img
          src={url}
          alt="Sent image"
          loading="lazy"
          onError={() => setErrored(true)}
          className="max-h-72 w-auto max-w-full object-cover transition-transform hover:scale-[1.01]"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl overflow-hidden rounded-3xl bg-black/95 p-0">
          <img src={url} alt="Sent image" className="max-h-[85vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
};

export const VoiceBubble = ({
  path,
  durationMs,
  mine,
}: {
  path: string;
  durationMs: number | null;
  mine: boolean;
}) => {
  const url = useSignedUrl(path);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (!url) return;
    let el = audio;
    if (!el) {
      el = new Audio(url);
      el.addEventListener("timeupdate", () => {
        if (el!.duration > 0) setProgress((el!.currentTime / el!.duration) * 100);
      });
      el.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
      });
      setAudio(el);
    }
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const fmt = (ms: number | null) => {
    if (!ms || ms < 0) return "0:00";
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const trackBg = mine ? "bg-white/30" : "bg-foreground/10";
  const fillBg = mine ? "bg-white" : "bg-primary";

  return (
    <div className="flex w-56 items-center gap-3 py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-white/25 text-primary-foreground" : "bg-foreground/10 text-foreground"
        } disabled:opacity-50`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {!url ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={`h-1.5 overflow-hidden rounded-full ${trackBg}`}>
          <div
            className={`h-full ${fillBg} transition-[width] duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={`text-[11px] tabular-nums ${
            mine ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {fmt(durationMs)}
        </span>
      </div>
    </div>
  );
};

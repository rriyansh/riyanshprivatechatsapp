import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  onSend: (blob: Blob, durationMs: number, mime: string) => Promise<void> | void;
  disabled?: boolean;
};

const pickMime = (): string => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const MAX_MS = 5 * 60 * 1000; // 5 min cap

export const VoiceRecorder = ({ onSend, disabled }: Props) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTsRef = useRef<number>(0);
  const tickRef = useRef<number | undefined>();

  useEffect(() => () => cleanup(), []);

  useEffect(() => {
    if (!blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const cleanup = () => {
    window.clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined") {
      toast.error("Recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chosenMime = pickMime();
      const mr = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
      setMime(mr.mimeType || chosenMime || "audio/webm");
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(finalBlob);
        cleanup();
        setRecording(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      startTsRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      tickRef.current = window.setInterval(() => {
        const e = Date.now() - startTsRef.current;
        setElapsed(e);
        if (e >= MAX_MS) stopRecording();
      }, 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")) {
        toast.error("Microphone access denied.");
      } else {
        toast.error("Couldn't start recording: " + msg);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const discard = () => {
    setBlob(null);
    setElapsed(0);
  };

  const send = async () => {
    if (!blob) return;
    setSending(true);
    try {
      await onSend(blob, elapsed, mime || "audio/webm");
      setBlob(null);
      setElapsed(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  // Preview state (after stop, before send)
  if (blob && previewUrl) {
    return (
      <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-background/70 px-2 py-1.5 animate-fade-in">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 rounded-full text-destructive hover:bg-destructive/10"
          onClick={discard}
          disabled={sending}
          aria-label="Discard recording"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <audio src={previewUrl} controls className="h-9 min-w-0 flex-1" />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(elapsed)}</span>
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={sending}
          className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)]"
          aria-label="Send voice note"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  // Recording state
  if (recording) {
    return (
      <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-background/70 px-3 py-2 animate-fade-in">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-medium">Recording…</span>
        <span className="ml-auto tabular-nums text-sm text-muted-foreground">{fmt(elapsed)}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full"
          onClick={stopRecording}
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  // Idle state — single mic button
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-11 w-11 shrink-0 rounded-full"
      onClick={startRecording}
      disabled={disabled}
      aria-label="Record voice note"
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
};

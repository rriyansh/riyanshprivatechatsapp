import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  file: File | null;
  onCancel: () => void;
  onSend: () => Promise<void> | void;
  sending?: boolean;
};

export const ImagePreviewDialog = ({ file, onCancel, onSend, sending }: Props) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl p-0">
        <div className="relative bg-black/90">
          {url && (
            <img
              src={url}
              alt="Selected"
              className="max-h-[70vh] w-full object-contain"
            />
          )}
          <button
            type="button"
            onClick={onCancel}
            className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0 text-sm text-muted-foreground">
            {file ? <span className="truncate">{file.name}</span> : null}
          </div>
          <Button
            onClick={onSend}
            disabled={sending}
            className="rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] px-5 shadow-[var(--shadow-elegant)]"
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

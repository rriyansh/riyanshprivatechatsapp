import { useRef } from "react";
import { ImageIcon, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  onPick: (file: File) => void;
  disabled?: boolean;
};

export const ImageAttachButton = ({ onPick, disabled }: Props) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={disabled}
            aria-label="Attach image"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-2xl">
          <DropdownMenuItem onSelect={() => galleryRef.current?.click()} className="gap-2">
            <ImageIcon className="h-4 w-4" /> Photo library
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()} className="gap-2">
            <Camera className="h-4 w-4" /> Take photo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
};

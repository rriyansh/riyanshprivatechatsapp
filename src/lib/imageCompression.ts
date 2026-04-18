// Client-side image compression. No external deps — uses canvas.
// Resizes to fit within maxDim and re-encodes as WebP (or JPEG fallback)
// at the given quality. Returns a Blob.

export type CompressOptions = {
  maxDim?: number; // longest side
  quality?: number; // 0..1
  mimeType?: "image/webp" | "image/jpeg";
};

export const compressImage = async (
  file: File,
  opts: CompressOptions = {}
): Promise<{ blob: Blob; ext: string; mime: string }> => {
  const { maxDim = 1600, quality = 0.82, mimeType = "image/webp" } = opts;

  // GIFs and SVGs: don't compress (would lose animation/vector). Just pass through.
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    const ext = file.type === "image/gif" ? "gif" : "svg";
    return { blob: file, ext, mime: file.type };
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = fit(bitmap.width, bitmap.height, maxDim);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      mimeType,
      quality
    );
  });

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  return { blob, ext, mime: mimeType };
};

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
};

const fit = (w: number, h: number, max: number) => {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w / h;
  if (w >= h) return { width: max, height: Math.round(max / ratio) };
  return { width: Math.round(max * ratio), height: max };
};

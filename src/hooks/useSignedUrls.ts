import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache signed URLs in memory for the page lifetime to avoid re-signing on every render.
// URLs are signed for 1 hour; we re-sign at most every 50 minutes.

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

const TTL_SEC = 60 * 60; // 1h
const REFRESH_BEFORE_MS = 10 * 60 * 1000; // refresh if <10min left

export const getSignedUrl = async (path: string): Promise<string | null> => {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - now > REFRESH_BEFORE_MS) {
    return cached.url;
  }
  const existing = inflight.get(path);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from("chat-media")
      .createSignedUrl(path, TTL_SEC);
    if (error || !data?.signedUrl) {
      console.error("[signed-url]", error?.message);
      return null;
    }
    cache.set(path, { url: data.signedUrl, expiresAt: now + TTL_SEC * 1000 });
    return data.signedUrl;
  })();

  inflight.set(path, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(path);
  }
};

export const useSignedUrl = (path: string | null | undefined) => {
  const [url, setUrl] = useState<string | null>(() =>
    path ? cache.get(path)?.url ?? null : null
  );
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedUrl(path).then((u) => {
      if (!cancelled.current) setUrl(u);
    });
    return () => {
      cancelled.current = true;
    };
  }, [path]);

  return url;
};

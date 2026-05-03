import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SESSION_KEY = "veltogram.active_session_id";

const detectDevice = () => {
  const ua = navigator.userAgent;
  let label = "Web browser";
  if (/iPhone|iPad|iPod/i.test(ua)) label = "iOS device";
  else if (/Android/i.test(ua)) label = "Android device";
  else if (/Mac/i.test(ua)) label = "Mac";
  else if (/Windows/i.test(ua)) label = "Windows PC";
  else if (/Linux/i.test(ua)) label = "Linux";

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return { label: `${label} · ${browser}`, ua };
};

/**
 * Tracks the current device as an active session row and pings last_active_at periodically.
 * Each browser/device gets a stable id stored in localStorage so reloads reuse the same row.
 */
export const useSessionTracking = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let intervalId: number | undefined;

    const ensureSession = async () => {
      const stored = localStorage.getItem(SESSION_KEY);
      const { label, ua } = detectDevice();

      if (stored) {
        // Try update first
        const { data, error } = await supabase
          .from("active_sessions")
          .update({ last_active_at: new Date().toISOString(), device_label: label, user_agent: ua })
          .eq("id", stored)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();
        if (!error && data) return;
        // Row was deleted (logged out remotely) → clear and re-create
        localStorage.removeItem(SESSION_KEY);
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("active_sessions")
        .insert({ user_id: user.id, device_label: label, user_agent: ua })
        .select("id")
        .single();
      if (!insertErr && inserted && !cancelled) {
        localStorage.setItem(SESSION_KEY, inserted.id);
      }
    };

    void ensureSession();
    intervalId = window.setInterval(ensureSession, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [user?.id]);
};

export const getCurrentSessionId = () => localStorage.getItem(SESSION_KEY);
export const clearLocalSessionId = () => localStorage.removeItem(SESSION_KEY);

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import type { AccentKey } from "@/lib/accentThemes";

export type MyProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme_pref: "light" | "dark" | "system";
  chat_accent: AccentKey;
  hide_last_seen: boolean;
  created_at: string;
};

type Ctx = {
  profile: MyProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<Ctx | undefined>(undefined);

export const MyProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { setThemePref, setAccent } = useTheme();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, username, display_name, avatar_url, bio, theme_pref, chat_accent, hide_last_seen, created_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data) {
      const typed = data as unknown as MyProfile;
      setProfile(typed);
      // Mirror server prefs into the theme context (server is source of truth on login)
      setThemePref(typed.theme_pref);
      setAccent(typed.chat_accent);
    }
    setLoading(false);
  }, [user?.id, setThemePref, setAccent]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [user?.id, refresh]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useMyProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useMyProfile must be used within MyProfileProvider");
  return ctx;
};

import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  LogOut,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  SunMoon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useTheme } from "@/hooks/useTheme";
import { ACCENTS, ACCENT_KEYS, AccentKey, accentSwatch } from "@/lib/accentThemes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, refresh } = useMyProfile();
  const { themePref, setThemePref, accent, setAccent } = useTheme();
  const [saving, setSaving] = useState(false);

  const updateProfile = async (
    patch: Partial<{
      theme_pref: "light" | "dark" | "system";
      chat_accent: AccentKey;
      hide_last_seen: boolean;
    }>
  ) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await refresh();
    return true;
  };

  const handleTheme = async (t: "light" | "dark" | "system") => {
    setThemePref(t);
    await updateProfile({ theme_pref: t });
  };

  const handleAccent = async (a: AccentKey) => {
    setAccent(a);
    await updateProfile({ chat_accent: a });
  };

  const handleHideLastSeen = async (v: boolean) => {
    const ok = await updateProfile({ hide_last_seen: v });
    if (ok) toast.success(v ? "Last seen is now hidden" : "Last seen is visible");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
        {saving && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      <div className="space-y-4 px-5 py-5">
        {/* Account */}
        <Section title="Account">
          <Link to="/settings/profile" className="block">
            <Row
              icon={<Edit3 className="h-4 w-4" />}
              label="Edit profile"
              value={profile?.display_name || ""}
              chevron
            />
          </Link>
          <Link to="/me" className="block">
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="View my profile" chevron />
          </Link>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="px-4 py-3">
            <p className="mb-2 text-sm font-medium">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              <ThemeChip
                active={themePref === "light"}
                onClick={() => handleTheme("light")}
                icon={<Sun className="h-4 w-4" />}
                label="Light"
              />
              <ThemeChip
                active={themePref === "dark"}
                onClick={() => handleTheme("dark")}
                icon={<Moon className="h-4 w-4" />}
                label="Dark"
              />
              <ThemeChip
                active={themePref === "system"}
                onClick={() => handleTheme("system")}
                icon={<SunMoon className="h-4 w-4" />}
                label="System"
              />
            </div>
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <Palette className="h-4 w-4" /> Chat accent
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Sets your global bubble color. You can override per chat from a conversation.
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleAccent(k)}
                  className={cn(
                    "group relative h-10 w-10 rounded-full transition-transform",
                    accent === k
                      ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "hover:scale-105"
                  )}
                  style={{ background: accentSwatch(k) }}
                  aria-label={ACCENTS[k].label}
                  title={ACCENTS[k].label}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              {profile?.hide_last_seen ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Hide last seen</p>
                <p className="text-xs text-muted-foreground">
                  Others won't see when you were last online.
                </p>
              </div>
            </div>
            <Switch
              checked={profile?.hide_last_seen ?? false}
              onCheckedChange={handleHideLastSeen}
            />
          </div>
          <Link to="/settings/blocked" className="block border-t border-border">
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Blocked users" chevron />
          </Link>
        </Section>

        {/* Legal */}
        <Section title="About">
          <Link to="/privacy" className="block">
            <Row icon={<FileText className="h-4 w-4" />} label="Privacy Policy" chevron />
          </Link>
          <Link to="/terms" className="block border-t border-border">
            <Row icon={<FileText className="h-4 w-4" />} label="Terms of Service" chevron />
          </Link>
        </Section>

        <Button
          variant="outline"
          onClick={handleSignOut}
          className="h-12 w-full rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </h2>
    <div className="overflow-hidden rounded-3xl glass">{children}</div>
  </section>
);

const Row = ({
  icon,
  label,
  value,
  chevron,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  chevron?: boolean;
}) => (
  <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-accent">
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {value && <span className="max-w-[160px] truncate">{value}</span>}
      {chevron && <ChevronRight className="h-4 w-4" />}
    </div>
  </div>
);

const ThemeChip = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-xs font-medium transition-all",
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

export default Settings;

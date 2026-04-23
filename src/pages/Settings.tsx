import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AtSign,
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Heart,
  ImagePlus,
  Keyboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Moon,
  Palette,
  ReceiptText,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMoon,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useTheme } from "@/hooks/useTheme";
import { ACCENTS, ACCENT_KEYS, AccentKey, accentSwatch } from "@/lib/accentThemes";
import { compressImage } from "@/lib/imageCompression";
import { profileEditSchema } from "@/lib/profileSchemas";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type OnlineVisibility = "everyone" | "followers" | "nobody";

type ProfilePatch = Partial<{
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  theme_pref: "light" | "dark" | "system";
  chat_accent: AccentKey;
  hide_last_seen: boolean;
  private_account: boolean;
  read_receipts: boolean;
  typing_indicators: boolean;
  screenshot_protection: boolean;
  online_status_visibility: OnlineVisibility;
}>;

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, refresh } = useMyProfile();
  const { themePref, setThemePref, accent, setAccent } = useTheme();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
  }, [profile?.user_id]);

  useEffect(() => {
    if (!user || !username || username === profile?.username) {
      setUsernameStatus("idle");
      return;
    }

    const parsed = profileEditSchema.shape.username.safeParse(username);
    if (!parsed.success) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");
    const id = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", parsed.data)
        .maybeSingle();

      if (error) {
        setUsernameStatus("idle");
        return;
      }
      setUsernameStatus(!data || data.user_id === user.id ? "available" : "taken");
    }, 450);

    return () => window.clearTimeout(id);
  }, [username, profile?.username, user?.id]);

  const initials = useMemo(
    () => (displayName || username || profile?.display_name || profile?.username || "V")[0]?.toUpperCase(),
    [displayName, username, profile?.display_name, profile?.username]
  );

  const updateProfile = async (patch: ProfilePatch) => {
    if (!user) return false;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "That username is taken." : error.message);
      return false;
    }
    await refresh();
    return true;
  };

  const handleSaveAccount = async () => {
    const parsed = profileEditSchema.safeParse({ username, display_name: displayName, bio });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    if (usernameStatus === "taken") {
      toast.error("That username is taken.");
      return;
    }
    const ok = await updateProfile({
      username: parsed.data.username,
      display_name: parsed.data.display_name,
      bio: parsed.data.bio || null,
    });
    if (ok) toast.success("Account updated");
  };

  const handleAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB).");
      return;
    }

    setUploading(true);
    try {
      const { blob, ext, mime } = await compressImage(file, { maxDim: 512, quality: 0.86 });
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const ok = await updateProfile({ avatar_url: data.publicUrl });
      if (ok) toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleTheme = async (t: "light" | "dark" | "system") => {
    setThemePref(t);
    await updateProfile({ theme_pref: t });
  };

  const handleAccent = async (a: AccentKey) => {
    setAccent(a);
    await updateProfile({ chat_accent: a });
  };

  const handleToggle = async (patch: ProfilePatch, message: string) => {
    const ok = await updateProfile(patch);
    if (ok) toast.success(message);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-b-3xl px-3 py-3">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">Account, privacy, and app preferences</p>
        </div>
        {(saving || uploading) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      <div className="space-y-6 px-5 py-5">
        <section className="overflow-hidden rounded-[2rem] glass-strong animate-fade-in">
          <div className="border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <UserRound className="h-4 w-4" /> Account
            </div>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 ring-4 ring-background shadow-[var(--shadow-elegant)]">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-2xl font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="settings-avatar"
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-105"
                    aria-label="Change profile picture"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </label>
                  <input
                    id="settings-avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleAvatar(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{displayName || "Add nickname"}</p>
                  <p className="truncate text-sm text-muted-foreground">@{username || "username"}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{bio || "Add a short bio to personalize your profile."}</p>
                </div>
              </div>
            </div>

            <Button type="button" variant="outline" className="h-12 w-full justify-between rounded-2xl" onClick={() => navigate("/me")}>
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Account preview</span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="grid gap-4">
              <Field label="Username" hint="3–24 chars · lowercase, numbers, underscores">
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value.toLowerCase())}
                    maxLength={24}
                    className="h-12 rounded-2xl pl-9 pr-10"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {usernameStatus === "available" && <Check className="h-4 w-4 text-primary" />}
                    {usernameStatus === "taken" && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                {usernameStatus === "available" && <p className="text-xs text-primary">Username is available</p>}
                {usernameStatus === "taken" && <p className="text-xs text-destructive">Username is already taken</p>}
              </Field>

              <Field label="Nickname" hint={`${displayName.length}/40`}>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} className="h-12 rounded-2xl" />
              </Field>

              <Field label="Bio" hint={`${bio.length}/180`}>
                <Textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={180}
                  rows={4}
                  className="resize-none rounded-2xl"
                  placeholder="Tell people about yourself…"
                />
              </Field>
            </div>

            <Button onClick={handleSaveAccount} disabled={saving || usernameStatus === "checking"} className="h-12 w-full rounded-2xl text-base font-semibold shadow-[var(--shadow-elegant)]">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save account"}
            </Button>
          </div>
        </section>

        <Section title="Appearance" icon={<Palette className="h-4 w-4" />}>
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-3 text-sm font-medium">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                <ThemeChip active={themePref === "light"} onClick={() => handleTheme("light")} icon={<Sun className="h-4 w-4" />} label="Light" />
                <ThemeChip active={themePref === "dark"} onClick={() => handleTheme("dark")} icon={<Moon className="h-4 w-4" />} label="Dark" />
                <ThemeChip active={themePref === "system"} onClick={() => handleTheme("system")} icon={<SunMoon className="h-4 w-4" />} label="System" />
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Chat accent color</p>
                  <p className="text-xs text-muted-foreground">Changes bubbles, focus rings, and highlights.</p>
                </div>
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-2.5">
                {ACCENT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAccent(key)}
                    className={cn(
                      "relative h-11 w-11 rounded-full transition-all duration-200",
                      accent === key ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-105"
                    )}
                    style={{ background: accentSwatch(key) }}
                    aria-label={ACCENTS[key].label}
                    title={ACCENTS[key].label}
                  >
                    {accent === key && <Check className="absolute inset-0 m-auto h-4 w-4 text-primary-foreground mix-blend-difference" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Privacy" icon={<Shield className="h-4 w-4" />}>
          <div className="divide-y divide-border/70">
            <ToggleRow
              icon={profile?.hide_last_seen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              title="Hide last seen"
              description="Keep your last active time private."
              checked={profile?.hide_last_seen ?? false}
              onChange={(value) => handleToggle({ hide_last_seen: value }, value ? "Last seen hidden" : "Last seen visible")}
            />
            <ToggleRow
              icon={<Lock className="h-4 w-4" />}
              title={profile?.private_account ? "Private account" : "Public account"}
              description="Control whether new people can freely view your profile."
              checked={profile?.private_account ?? false}
              onChange={(value) => handleToggle({ private_account: value }, value ? "Private account enabled" : "Public account enabled")}
            />
            <ToggleRow
              icon={<ReceiptText className="h-4 w-4" />}
              title="Read receipts"
              description="Let people know when you have seen messages."
              checked={profile?.read_receipts ?? true}
              onChange={(value) => handleToggle({ read_receipts: value }, value ? "Read receipts on" : "Read receipts off")}
            />
            <ToggleRow
              icon={<Keyboard className="h-4 w-4" />}
              title="Typing indicator"
              description="Show when you are typing in chats."
              checked={profile?.typing_indicators ?? true}
              onChange={(value) => handleToggle({ typing_indicators: value }, value ? "Typing indicator on" : "Typing indicator off")}
            />
            <ToggleRow
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Screenshot protection"
              description="Adds extra privacy signals where the browser allows it."
              checked={profile?.screenshot_protection ?? false}
              onChange={(value) => handleToggle({ screenshot_protection: value }, value ? "Screenshot protection on" : "Screenshot protection off")}
            />

            <div className="px-4 py-4">
              <Label htmlFor="online-visibility" className="text-sm font-medium">Online status visibility</Label>
              <p className="mt-1 text-xs text-muted-foreground">Choose who can see when you are online.</p>
              <select
                id="online-visibility"
                value={profile?.online_status_visibility ?? "everyone"}
                onChange={(event) => handleToggle({ online_status_visibility: event.target.value as OnlineVisibility }, "Online visibility updated")}
                className="mt-3 h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none ring-offset-background transition-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="everyone">Everyone</option>
                <option value="followers">Followers only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>

            <Link to="/settings/blocked" className="block">
              <Row icon={<ShieldCheck className="h-4 w-4" />} label="Blocked users list" chevron />
            </Link>
            <Link to="/settings/app-lock" className="block">
              <Row icon={<Lock className="h-4 w-4" />} label="App lock (PIN setup)" chevron />
            </Link>
          </div>
        </Section>

        <Section title="Legal" icon={<FileText className="h-4 w-4" />}>
          <Link to="/privacy" className="block">
            <Row icon={<FileText className="h-4 w-4" />} label="Privacy Policy" chevron />
          </Link>
          <Link to="/terms" className="block border-t border-border/70">
            <Row icon={<FileText className="h-4 w-4" />} label="Terms of Service" chevron />
          </Link>
        </Section>

        <Section title="Developer" icon={<Heart className="h-4 w-4" />}>
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Built by Riyansh</p>
              <p className="text-xs text-muted-foreground">PrivateChats · v1.0.0</p>
            </div>
          </div>
          <a href="mailto:folsriyansh@gmail.com?subject=PrivateChats%20Support" className="block border-t border-border/70">
            <Row icon={<Mail className="h-4 w-4" />} label="Contact support" value="folsriyansh@gmail.com" chevron />
          </a>
        </Section>

        <Button variant="outline" onClick={handleSignOut} className="h-12 w-full rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section className="animate-fade-in">
    <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {title}
    </h2>
    <div className="overflow-hidden rounded-[2rem] glass">{children}</div>
  </section>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
    {children}
  </div>
);

const Row = ({ icon, label, value, chevron }: { icon: React.ReactNode; label: string; value?: string; chevron?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-4 transition-colors hover:bg-accent">
    <div className="flex min-w-0 items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate text-sm font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {value && <span className="max-w-[160px] truncate">{value}</span>}
      {chevron && <ChevronRight className="h-4 w-4" />}
    </div>
  </div>
);

const ToggleRow = ({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 px-4 py-4">
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
  </div>
);

const ThemeChip = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-3xl border px-3 py-3 text-xs font-semibold transition-all duration-200",
      active ? "scale-[1.02] border-primary bg-primary/10 text-primary shadow-[var(--shadow-soft)]" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

export default Settings;

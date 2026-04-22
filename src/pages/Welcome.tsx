import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Loader2, Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useMyProfile";
import { compressImage } from "@/lib/imageCompression";
import { usernameSchema, displayNameSchema } from "@/lib/profileSchemas";

const Welcome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refresh } = useMyProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  // Prefill from existing profile
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  // Live username availability check (debounced)
  useEffect(() => {
    const v = username.trim().toLowerCase();
    setAvailable(null);
    if (!v || v === profile?.username) return;
    const parsed = usernameSchema.safeParse(v);
    if (!parsed.success) return;

    setChecking(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", v)
        .maybeSingle();
      setAvailable(!data);
      setChecking(false);
    }, 350);
    return () => {
      clearTimeout(t);
      setChecking(false);
    };
  }, [username, profile?.username]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    setUploading(true);
    try {
      const { blob, ext } = await compressImage(file, {
        maxDim: 512,
        quality: 0.85,
      });
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setAvatarPreview(URL.createObjectURL(blob));
      toast.success("Photo added");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    const u = usernameSchema.safeParse(username);
    if (!u.success) {
      toast.error(u.error.errors[0].message);
      return;
    }
    const d = displayNameSchema.safeParse(displayName);
    if (!d.success) {
      toast.error(d.error.errors[0].message);
      return;
    }
    if (available === false) {
      toast.error("That username is taken");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: u.data,
        display_name: d.data,
        avatar_url: avatarUrl,
        onboarded: true,
      })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        toast.error("That username is taken");
      } else {
        toast.error(error.message);
      }
      return;
    }
    await refresh();
    toast.success("You're all set!");
    navigate("/", { replace: true });
  };

  const handleNext = () => {
    if (step === 0) {
      const d = displayNameSchema.safeParse(displayName);
      if (!d.success) {
        toast.error(d.error.errors[0].message);
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      const u = usernameSchema.safeParse(username);
      if (!u.success) {
        toast.error(u.error.errors[0].message);
        return;
      }
      if (checking) {
        toast.error("Checking username, please wait");
        return;
      }
      if (available === false) {
        toast.error("That username is taken");
        return;
      }
      setStep(2);
      return;
    }
    handleFinish();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-scale-in glass-strong rounded-3xl p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)]">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your profile so friends can find you
          </p>
        </div>

        {/* Avatar */}
        <div className="mb-6 flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative"
            aria-label="Choose photo"
          >
            <Avatar className="h-24 w-24 ring-2 ring-primary/40">
              <AvatarImage src={avatarPreview || avatarUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {(displayName || username || "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatar}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Tap to add a photo (optional)
          </p>
        </div>

        {/* Display name */}
        <div className="space-y-1.5">
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe"
            maxLength={40}
            className="h-12 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            What people will see in chats
          </p>
        </div>

        {/* Username */}
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="un">Username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              id="un"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              placeholder="janedoe"
              maxLength={24}
              className="h-12 rounded-xl pl-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
              {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!checking && available === true && (
                <span className="text-primary">✓ available</span>
              )}
              {!checking && available === false && (
                <span className="text-destructive">taken</span>
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, underscores. You can also log in with this.
          </p>
        </div>

        <Button
          onClick={handleFinish}
          disabled={saving || uploading || available === false}
          className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-base font-semibold shadow-[var(--shadow-elegant)]"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Welcome;

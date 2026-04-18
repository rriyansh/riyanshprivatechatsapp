import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useMyProfile";
import { supabase } from "@/integrations/supabase/client";
import { profileEditSchema } from "@/lib/profileSchemas";
import { toast } from "sonner";

const EditProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refresh } = useMyProfile();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
  }, [profile?.user_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = profileEditSchema.safeParse({
      username: username,
      display_name: displayName,
      bio,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: parsed.data.username,
        display_name: parsed.data.display_name,
        bio: parsed.data.bio || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      // Unique-violation surface
      if (error.code === "23505") {
        toast.error("That username is taken.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    await refresh();
    toast.success("Profile saved");
    navigate("/me");
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
        <h1 className="text-lg font-semibold">Edit profile</h1>
      </header>

      <form onSubmit={handleSave} className="space-y-5 px-5 py-6">
        <div className="space-y-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            className="h-12 rounded-2xl"
          />
          <p className="text-xs text-muted-foreground">{displayName.length}/40</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={24}
              className="h-12 rounded-2xl pl-8"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            3–24 chars · lowercase, numbers, underscores
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={180}
            rows={3}
            className="resize-none rounded-2xl"
            placeholder="Tell people about yourself…"
          />
          <p className="text-xs text-muted-foreground">{bio.length}/180</p>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-base font-semibold shadow-[var(--shadow-elegant)]"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save changes"}
        </Button>
      </form>
    </div>
  );
};

export default EditProfile;

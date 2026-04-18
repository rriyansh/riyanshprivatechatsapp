import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Edit3,
  History,
  MessageSquare,
  Settings as SettingsIcon,
  Loader2,
  Camera,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import { useEffect } from "react";

const Profile = () => {
  const { user } = useAuth();
  const { profile, loading, refresh } = useMyProfile();
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<
    { id: string; old_username: string | null; new_username: string; changed_at: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("followee_id", user.id),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", user.id),
      ]);
      setCounts({ followers: followers ?? 0, following: following ?? 0 });
    })();
  }, [user?.id]);

  const loadHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("username_history")
      .select("id, old_username, new_username, changed_at")
      .eq("user_id", user.id)
      .order("changed_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHistory(data ?? []);
    setHistoryOpen(true);
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
      const { blob, ext, mime } = await compressImage(file, { maxDim: 512, quality: 0.85 });
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      await refresh();
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      {/* Header banner */}
      <div className="relative mt-4 overflow-hidden rounded-3xl glass-strong px-6 pb-6 pt-8">
        <div className="absolute right-4 top-4 flex gap-2">
          <Link to="/settings">
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="Settings">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <Avatar className="h-28 w-28 ring-4 ring-background shadow-[var(--shadow-elegant)]">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-3xl">
                {(profile.display_name || profile.username || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-input"
              className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-105"
              aria-label="Change avatar"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
                e.target.value = "";
              }}
            />
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-3 max-w-md text-[15px] leading-relaxed">{profile.bio}</p>
          )}

          {/* Counts */}
          <div className="mt-5 flex items-center gap-6">
            <Stat label="Followers" value={counts.followers} />
            <Stat label="Following" value={counts.following} />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/settings/profile">
              <Button className="rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] px-5 shadow-[var(--shadow-elegant)]">
                <Edit3 className="mr-1.5 h-4 w-4" />
                Edit profile
              </Button>
            </Link>
            <Button variant="outline" className="rounded-full" onClick={loadHistory}>
              <History className="mr-1.5 h-4 w-4" />
              Username history
            </Button>
          </div>
        </div>
      </div>

      {/* Account info */}
      <section className="mt-4 rounded-3xl glass px-5 py-4">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Account</h2>
        <Row
          icon={<Calendar className="h-4 w-4" />}
          label="Joined"
          value={format(new Date(profile.created_at), "MMMM d, yyyy")}
        />
        <Row
          icon={<MessageSquare className="h-4 w-4" />}
          label="Email"
          value={user?.email ?? "—"}
        />
      </section>

      {/* Username history dialog (inline list, simple) */}
      {historyOpen && (
        <section className="mt-4 animate-fade-in rounded-3xl glass px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Username history</h2>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          {history.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h, i) => (
                <li key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Check className="h-3.5 w-3.5 text-primary" />}
                    <span className="font-medium">@{h.new_username}</span>
                    {h.old_username && (
                      <span className="text-muted-foreground">
                        (was @{h.old_username})
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(h.changed_at), "MMM d, yyyy")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="text-center">
    <div className="text-xl font-bold tabular-nums">{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

const Row = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <span className="truncate text-sm font-medium">{value}</span>
  </div>
);

export default Profile;

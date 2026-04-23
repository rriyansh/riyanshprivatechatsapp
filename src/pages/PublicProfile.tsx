import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MessageSquare,
  MoreVertical,
  ShieldOff,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  blockUser,
  fetchFollowStatus,
  follow,
  unblockUser,
  unfollow,
} from "@/lib/follows";
import { toast } from "sonner";
import { ProfilePosts } from "@/components/posts/ProfilePosts";

type PublicProfileData = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  last_seen: string | null;
  followers_count: number;
  following_count: number;
};

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState({
    isFollowing: false,
    isBlocked: false,
    iBlockedThem: false,
  });
  const [busy, setBusy] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = async () => {
    if (!username || !user) return;
    setLoading(true);
    setNotFound(false);
    const { data, error } = await supabase
      .from("profiles_public")
      .select("*")
      .eq("username", username.toLowerCase())
      .maybeSingle();
    if (error) toast.error(error.message);
    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const typed = data as unknown as PublicProfileData;
    setProfile(typed);
    if (typed.user_id !== user.id) {
      setStatus(await fetchFollowStatus(user.id, typed.user_id));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [username, user?.id]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <UserX className="mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">User not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          @{username} doesn't exist or isn't available.
        </p>
        <Button onClick={() => navigate("/search")} className="mt-5 rounded-full">
          Back to search
        </Button>
      </div>
    );
  }

  const isMe = user?.id === profile.user_id;

  const handleFollow = async () => {
    if (!user || isMe) return;
    setBusy(true);
    try {
      if (status.isFollowing) {
        await unfollow(user.id, profile.user_id);
        setStatus((s) => ({ ...s, isFollowing: false }));
        setProfile((p) => p && { ...p, followers_count: Math.max(0, p.followers_count - 1) });
      } else {
        await follow(user.id, profile.user_id);
        setStatus((s) => ({ ...s, isFollowing: true }));
        setProfile((p) => p && { ...p, followers_count: p.followers_count + 1 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleBlock = async () => {
    if (!user || isMe) return;
    setBusy(true);
    try {
      await blockUser(user.id, profile.user_id);
      toast.success(`Blocked @${profile.username}`);
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to block");
      setBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await unblockUser(user.id, profile.user_id);
      toast.success("Unblocked");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unblock");
    } finally {
      setBusy(false);
    }
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
        <h1 className="truncate text-lg font-semibold">@{profile.username}</h1>
        {!isMe && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto rounded-full"
                aria-label="More"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              {status.iBlockedThem ? (
                <DropdownMenuItem onSelect={handleUnblock} className="gap-2">
                  <ShieldOff className="h-4 w-4" /> Unblock
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => setConfirmBlock(true)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <UserX className="h-4 w-4" /> Block @{profile.username}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="px-5 pt-5">
        <div className="rounded-3xl glass-strong px-6 pb-6 pt-7">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-28 w-28 ring-4 ring-background shadow-[var(--shadow-elegant)]">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-3xl">
                {(profile.display_name || profile.username || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">
              {profile.display_name || profile.username}
            </h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-3 max-w-md text-[15px] leading-relaxed">{profile.bio}</p>
            )}

            <div className="mt-5 flex items-center gap-6">
              <Stat label="Posts" value={postCount} />
              <Stat label="Followers" value={profile.followers_count} />
              <Stat label="Following" value={profile.following_count} />
            </div>

            {!isMe && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {status.iBlockedThem ? (
                  <Button
                    onClick={handleUnblock}
                    disabled={busy}
                    variant="outline"
                    className="rounded-full"
                  >
                    <ShieldOff className="mr-1.5 h-4 w-4" />
                    Unblock
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleFollow}
                      disabled={busy}
                      className={
                        status.isFollowing
                          ? "rounded-full"
                          : "rounded-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] shadow-[var(--shadow-elegant)]"
                      }
                      variant={status.isFollowing ? "outline" : "default"}
                    >
                      {status.isFollowing ? (
                        <>
                          <UserCheck className="mr-1.5 h-4 w-4" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-1.5 h-4 w-4" /> Follow
                        </>
                      )}
                    </Button>
                    <Link to={`/chat/${profile.user_id}`}>
                      <Button variant="outline" className="rounded-full">
                        <MessageSquare className="mr-1.5 h-4 w-4" />
                        Message
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <section className="mt-4 rounded-3xl glass px-5 py-4">
          <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Joined</span>
            </div>
            <span className="text-sm font-medium">
              {format(new Date(profile.created_at), "MMMM yyyy")}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Last seen</span>
            </div>
            <span className="text-sm font-medium">
              {profile.last_seen ? format(new Date(profile.last_seen), "PPp") : "Hidden"}
            </span>
          </div>
        </section>
      </div>

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{profile.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to see your profile, message you, or follow you. Your
              existing chat with them will be hidden. You can unblock anytime in Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              className="rounded-full bg-destructive hover:bg-destructive/90"
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="text-center">
    <div className="text-xl font-bold tabular-nums">{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

export default PublicProfile;

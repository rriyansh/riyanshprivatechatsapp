import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, ImagePlus, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Post = {
  id: string;
  user_id: string;
  image_path: string;
  caption: string;
  tagged_usernames: string[];
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

type ProfilePostsProps = {
  userId: string;
  isOwn?: boolean;
  onCountChange?: (count: number) => void;
};

const signedCache = new Map<string, string>();

const extractTags = (caption: string) =>
  Array.from(new Set((caption.match(/@([a-z0-9_]{3,24})/gi) ?? []).map((tag) => tag.slice(1).toLowerCase()))).slice(0, 20);

const renderCaption = (caption: string) =>
  caption.split(/(@[a-z0-9_]{3,24})/gi).map((part, index) => {
    if (!part.startsWith("@")) return <span key={`${part}-${index}`}>{part}</span>;
    const username = part.slice(1).toLowerCase();
    return (
      <Link key={`${part}-${index}`} to={`/u/${username}`} className="font-semibold text-primary hover:underline">
        {part}
      </Link>
    );
  });

const usePostImage = (path: string | null) => {
  const [url, setUrl] = useState(() => (path ? signedCache.get(path) ?? null : null));
  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = signedCache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    supabase.storage
      .from("post-media")
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) return;
        signedCache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
};

const PostImage = ({ path, className }: { path: string; className?: string }) => {
  const url = usePostImage(path);
  return url ? (
    <img src={url} alt="Post" loading="lazy" className={cn("h-full w-full object-cover", className)} />
  ) : (
    <div className={cn("flex h-full w-full animate-pulse items-center justify-center bg-muted", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
};

export const ProfilePosts = ({ userId, isOwn = false, onCountChange }: ProfilePostsProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<Post | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts" as never)
      .select("id, user_id, image_path, caption, tagged_usernames, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const next = ((data ?? []) as unknown) as Post[];
    setPosts(next);
    onCountChange?.(next.length);
    setLoading(false);
  };

  useEffect(() => {
    loadPosts();
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`profile-posts:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `user_id=eq.${userId}` }, loadPosts)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <section className="mt-4 rounded-3xl glass p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold">Posts</h2>
          <p className="text-xs text-muted-foreground">Photos, captions, likes, and comments</p>
        </div>
        {isOwn && (
          <Button size="sm" onClick={() => setComposerOpen(true)} className="rounded-full">
            <ImagePlus className="mr-1.5 h-4 w-4" /> New post
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-12 text-center">
          <ImagePlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No posts yet</p>
          <p className="text-xs text-muted-foreground">Shared photos will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {posts.map((post) => (
            <button key={post.id} onClick={() => setSelected(post)} className="group aspect-square overflow-hidden rounded-xl bg-muted">
              <PostImage path={post.image_path} className="transition-transform duration-300 group-hover:scale-105" />
            </button>
          ))}
        </div>
      )}

      <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={loadPosts} />
      <PostDetail post={selected} open={!!selected} onOpenChange={(v) => !v && setSelected(null)} />
    </section>
  );
};

const PostComposer = ({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async () => {
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image.");
      return;
    }
    if (caption.length > 2200) {
      toast.error("Caption is too long.");
      return;
    }
    setSaving(true);
    try {
      const { blob, ext, mime } = await compressImage(file, { maxDim: 1600, quality: 0.84 });
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("post-media").upload(path, blob, { contentType: mime, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("posts" as never).insert({
        user_id: user.id,
        image_path: path,
        caption: caption.trim(),
        tagged_usernames: extractTags(caption),
      } as never);
      if (error) throw error;
      setCaption("");
      setFile(null);
      onOpenChange(false);
      onCreated();
      toast.success("Post shared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>Create post</DialogTitle></DialogHeader>
        <button type="button" onClick={() => inputRef.current?.click()} className="aspect-square overflow-hidden rounded-3xl border border-dashed border-border bg-muted">
          {preview ? <img src={preview} alt="Selected post preview" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-sm text-muted-foreground"><ImagePlus className="mr-2 h-5 w-5" /> Choose image</span>}
        </button>
        <Input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={4} placeholder="Write a caption… tag people with @username" className="resize-none rounded-2xl" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{caption.length}/2200</span>
          <Button onClick={submit} disabled={!file || saving} className="rounded-2xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PostDetail = ({ post, open, onOpenChange }: { post: Post | null; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<string[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const liked = !!user && likes.includes(user.id);

  const loadMeta = async () => {
    if (!post) return;
    const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
      supabase.from("post_likes" as never).select("user_id").eq("post_id", post.id),
      supabase
        .from("post_comments" as never)
        .select("id, post_id, user_id, content, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true }),
    ]);
    setLikes((((likeRows ?? []) as unknown) as { user_id: string }[]).map((l) => l.user_id));
    setComments(((commentRows ?? []) as unknown) as Comment[]);
  };

  useEffect(() => {
    if (open) loadMeta();
  }, [open, post?.id]);

  useEffect(() => {
    if (!post || !open) return;
    const channel = supabase
      .channel(`post-detail:${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes", filter: `post_id=eq.${post.id}` }, loadMeta)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` }, loadMeta)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [post?.id, open]);

  const toggleLike = async () => {
    if (!user || !post || busy) return;
    setBusy(true);
    if (liked) {
      const { error } = await supabase.from("post_likes" as never).delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) toast.error(error.message);
      else setLikes((prev) => prev.filter((id) => id !== user.id));
    } else {
      const { error } = await supabase.from("post_likes" as never).insert({ post_id: post.id, user_id: user.id } as never);
      if (error) toast.error(error.message);
      else setLikes((prev) => [...prev, user.id]);
    }
    setBusy(false);
  };

  const submitComment = async () => {
    if (!user || !post || !comment.trim()) return;
    const content = comment.trim();
    if (content.length > 500) {
      toast.error("Comment is too long.");
      return;
    }
    setComment("");
    const { error } = await supabase.from("post_comments" as never).insert({ post_id: post.id, user_id: user.id, content } as never);
    if (error) {
      toast.error(error.message);
      setComment(content);
    } else {
      loadMeta();
    }
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-3xl p-0">
        <div className="aspect-square bg-muted"><PostImage path={post.image_path} /></div>
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            <span>{comments.length} comments</span>
          </div>
          {post.caption && <p className="whitespace-pre-wrap text-sm leading-6">{renderCaption(post.caption)}</p>}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleLike} className={cn("rounded-full", liked && "text-destructive")}>
              <Heart className={cn("mr-1.5 h-4 w-4", liked && "fill-current")} /> {likes.length}
            </Button>
            <span className="flex items-center text-sm text-muted-foreground"><MessageCircle className="mr-1.5 h-4 w-4" /> Comments</span>
          </div>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-2xl bg-muted/60 px-3 py-2">
                <p className="text-sm">{renderCaption(c.content)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Add a comment…" className="rounded-2xl" />
            <Button size="icon" onClick={submitComment} className="rounded-full"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

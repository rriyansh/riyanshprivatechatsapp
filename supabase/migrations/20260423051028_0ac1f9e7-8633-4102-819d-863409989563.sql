CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_path text NOT NULL,
  caption text NOT NULL DEFAULT '',
  tagged_usernames text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shared_chat_wallpapers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  wallpaper_data text NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_chat_wallpapers_pair_order CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

ALTER TABLE public.shared_chat_wallpapers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON public.post_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_shared_chat_wallpapers_pair ON public.shared_chat_wallpapers(user_a, user_b);

DROP POLICY IF EXISTS "Authenticated users can view visible posts" ON public.posts;
CREATE POLICY "Authenticated users can view visible posts"
ON public.posts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR NOT public.is_blocked_between(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
ON public.posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
ON public.posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
ON public.posts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view visible post likes" ON public.post_likes;
CREATE POLICY "Authenticated users can view visible post likes"
ON public.post_likes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_likes.post_id
    AND (auth.uid() = p.user_id OR NOT public.is_blocked_between(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Users can like visible posts as themselves" ON public.post_likes;
CREATE POLICY "Users can like visible posts as themselves"
ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_likes.post_id
    AND (auth.uid() = p.user_id OR NOT public.is_blocked_between(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Users can remove their own post likes" ON public.post_likes;
CREATE POLICY "Users can remove their own post likes"
ON public.post_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view visible post comments" ON public.post_comments;
CREATE POLICY "Authenticated users can view visible post comments"
ON public.post_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_comments.post_id
    AND (auth.uid() = p.user_id OR NOT public.is_blocked_between(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Users can comment on visible posts as themselves" ON public.post_comments;
CREATE POLICY "Users can comment on visible posts as themselves"
ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND char_length(content) <= 500 AND EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.id = post_comments.post_id
    AND (auth.uid() = p.user_id OR NOT public.is_blocked_between(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Users can update their own post comments" ON public.post_comments;
CREATE POLICY "Users can update their own post comments"
ON public.post_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND char_length(content) <= 500);

DROP POLICY IF EXISTS "Users can delete their own post comments" ON public.post_comments;
CREATE POLICY "Users can delete their own post comments"
ON public.post_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants can view shared chat wallpapers" ON public.shared_chat_wallpapers;
CREATE POLICY "Participants can view shared chat wallpapers"
ON public.shared_chat_wallpapers FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Participants can set shared chat wallpapers" ON public.shared_chat_wallpapers;
CREATE POLICY "Participants can set shared chat wallpapers"
ON public.shared_chat_wallpapers FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND updated_by = auth.uid());

DROP POLICY IF EXISTS "Participants can update shared chat wallpapers" ON public.shared_chat_wallpapers;
CREATE POLICY "Participants can update shared chat wallpapers"
ON public.shared_chat_wallpapers FOR UPDATE TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND updated_by = auth.uid());

DROP POLICY IF EXISTS "Participants can remove shared chat wallpapers" ON public.shared_chat_wallpapers;
CREATE POLICY "Participants can remove shared chat wallpapers"
ON public.shared_chat_wallpapers FOR DELETE TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER update_post_comments_updated_at
BEFORE UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own post media" ON storage.objects;
CREATE POLICY "Users can upload their own post media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view visible post media" ON storage.objects;
CREATE POLICY "Users can view visible post media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'post-media' AND EXISTS (
  SELECT 1 FROM public.posts p
  WHERE p.image_path = storage.objects.name
    AND (auth.uid() = p.user_id OR NOT public.is_blocked_between(auth.uid(), p.user_id))
));

DROP POLICY IF EXISTS "Users can delete their own post media" ON storage.objects;
CREATE POLICY "Users can delete their own post media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_chat_wallpapers;
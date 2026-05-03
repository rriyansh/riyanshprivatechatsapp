
-- =========================
-- Profile extensions
-- =========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_visibility text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS dm_permission text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS follow_permission text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS profile_photo_visibility text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS comment_permission text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS tag_permission text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_last_seen_visibility_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_last_seen_visibility_check
  CHECK (last_seen_visibility IN ('everyone','contacts','nobody'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_dm_permission_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dm_permission_check
  CHECK (dm_permission IN ('everyone','followers','nobody'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_follow_permission_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_follow_permission_check
  CHECK (follow_permission IN ('everyone','nobody'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_photo_visibility_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_photo_visibility_check
  CHECK (profile_photo_visibility IN ('everyone','contacts','nobody'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_comment_permission_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_comment_permission_check
  CHECK (comment_permission IN ('everyone','followers','nobody'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tag_permission_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tag_permission_check
  CHECK (tag_permission IN ('everyone','followers','nobody'));

-- =========================
-- restricted_users
-- =========================
CREATE TABLE IF NOT EXISTS public.restricted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restrictor_id uuid NOT NULL,
  restricted_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restrictor_id, restricted_id),
  CHECK (restrictor_id <> restricted_id)
);
ALTER TABLE public.restricted_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own restricted list" ON public.restricted_users;
CREATE POLICY "Users can view their own restricted list"
  ON public.restricted_users FOR SELECT TO authenticated
  USING (auth.uid() = restrictor_id);

DROP POLICY IF EXISTS "Users can add to their own restricted list" ON public.restricted_users;
CREATE POLICY "Users can add to their own restricted list"
  ON public.restricted_users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = restrictor_id AND restrictor_id <> restricted_id);

DROP POLICY IF EXISTS "Users can remove from their own restricted list" ON public.restricted_users;
CREATE POLICY "Users can remove from their own restricted list"
  ON public.restricted_users FOR DELETE TO authenticated
  USING (auth.uid() = restrictor_id);

CREATE INDEX IF NOT EXISTS restricted_users_restrictor_idx ON public.restricted_users (restrictor_id);

-- =========================
-- ghost_targets
-- =========================
CREATE TABLE IF NOT EXISTS public.ghost_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hidden_from_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hidden_from_id),
  CHECK (user_id <> hidden_from_id)
);
ALTER TABLE public.ghost_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ghost list" ON public.ghost_targets;
CREATE POLICY "Users can view their own ghost list"
  ON public.ghost_targets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to their own ghost list" ON public.ghost_targets;
CREATE POLICY "Users can add to their own ghost list"
  ON public.ghost_targets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_id <> hidden_from_id);

DROP POLICY IF EXISTS "Users can remove from their own ghost list" ON public.ghost_targets;
CREATE POLICY "Users can remove from their own ghost list"
  ON public.ghost_targets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ghost_targets_user_idx ON public.ghost_targets (user_id);

-- =========================
-- active_sessions
-- =========================
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_label text NOT NULL DEFAULT 'Unknown device',
  user_agent text,
  ip_hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON public.active_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.active_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.active_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.active_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.active_sessions;
CREATE POLICY "Users can update their own sessions"
  ON public.active_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.active_sessions;
CREATE POLICY "Users can delete their own sessions"
  ON public.active_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS active_sessions_user_idx ON public.active_sessions (user_id, last_active_at DESC);

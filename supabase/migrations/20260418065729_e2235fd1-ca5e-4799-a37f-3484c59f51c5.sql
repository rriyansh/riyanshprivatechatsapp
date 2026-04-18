-- ============================================================================
-- 1) PROFILES: new columns for settings/theme/privacy
-- ============================================================================
alter table public.profiles
  add column if not exists theme_pref text not null default 'system'
    check (theme_pref in ('light','dark','system')),
  add column if not exists chat_accent text not null default 'blue'
    check (chat_accent in ('blue','purple','pink','green','orange','red','graphite')),
  add column if not exists hide_last_seen boolean not null default false;

-- Username format constraint (only if not already present)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (
        username is null
        or (
          char_length(username) between 3 and 24
          and username ~ '^[a-z0-9_]+$'
        )
      );
  end if;
end $$;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_user_id_idx on public.profiles(user_id);

-- ============================================================================
-- 2) USERNAME HISTORY (auto-tracked)
-- ============================================================================
create table if not exists public.username_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_username text,
  new_username text not null,
  changed_at timestamptz not null default now()
);

create index if not exists username_history_user_idx
  on public.username_history(user_id, changed_at desc);

alter table public.username_history enable row level security;

drop policy if exists "Users can view their own username history" on public.username_history;
create policy "Users can view their own username history"
  on public.username_history for select
  to authenticated
  using (auth.uid() = user_id);

-- (No insert policy: only the trigger writes here, running as definer.)

create or replace function public.track_username_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.username is not null) then
    insert into public.username_history (user_id, old_username, new_username)
    values (new.user_id, null, new.username);
  elsif (tg_op = 'UPDATE'
         and new.username is distinct from old.username
         and new.username is not null) then
    insert into public.username_history (user_id, old_username, new_username)
    values (new.user_id, old.username, new.username);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_track_username on public.profiles;
create trigger profiles_track_username
  after insert or update of username on public.profiles
  for each row execute function public.track_username_change();

-- Backfill the current username as the first history row for existing profiles
insert into public.username_history (user_id, old_username, new_username, changed_at)
select p.user_id, null, p.username, p.created_at
from public.profiles p
where p.username is not null
  and not exists (
    select 1 from public.username_history h where h.user_id = p.user_id
  );

-- ============================================================================
-- 3) BLOCKS (hard-block). Define BEFORE follows / messages policies use it.
-- ============================================================================
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocker_idx on public.blocks(blocker_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "Users can view blocks they created" on public.blocks;
create policy "Users can view blocks they created"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "Users can create their own blocks" on public.blocks;
create policy "Users can create their own blocks"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can remove their own blocks" on public.blocks;
create policy "Users can remove their own blocks"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- Helper: is there a block in either direction between two users?
create or replace function public.is_blocked_between(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = _a and blocked_id = _b)
       or (blocker_id = _b and blocked_id = _a)
  );
$$;

-- ============================================================================
-- 4) FOLLOWS (Twitter-style). Blocked pairs cannot follow.
-- ============================================================================
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null,
  followee_id uuid not null,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_followee_idx on public.follows(followee_id);

alter table public.follows enable row level security;

drop policy if exists "Anyone authenticated can view follows" on public.follows;
create policy "Anyone authenticated can view follows"
  on public.follows for select
  to authenticated
  using (true);

drop policy if exists "Users can follow others (not when blocked)" on public.follows;
create policy "Users can follow others (not when blocked)"
  on public.follows for insert
  to authenticated
  with check (
    auth.uid() = follower_id
    and follower_id <> followee_id
    and not public.is_blocked_between(follower_id, followee_id)
  );

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- ============================================================================
-- 5) MESSAGES: tighten policies so blocked pairs cannot send/read
-- ============================================================================
drop policy if exists "Users can send messages as themselves" on public.messages;
create policy "Users can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> receiver_id
    and not public.is_blocked_between(sender_id, receiver_id)
  );

drop policy if exists "Users can view their own messages" on public.messages;
create policy "Users can view their own messages"
  on public.messages for select
  to authenticated
  using (
    (auth.uid() = sender_id or auth.uid() = receiver_id)
    and not public.is_blocked_between(sender_id, receiver_id)
  );

-- ============================================================================
-- 6) PROFILES RLS: hide profiles from users you've blocked / who blocked you
-- ============================================================================
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = user_id
    or not public.is_blocked_between(auth.uid(), user_id)
  );

-- ============================================================================
-- 7) PER-CONVERSATION CHAT THEMES (optional override of profile.chat_accent)
-- ============================================================================
create table if not exists public.chat_themes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  partner_id uuid not null,
  accent text not null check (accent in ('blue','purple','pink','green','orange','red','graphite')),
  updated_at timestamptz not null default now(),
  unique (owner_id, partner_id),
  check (owner_id <> partner_id)
);

create index if not exists chat_themes_owner_idx on public.chat_themes(owner_id);

alter table public.chat_themes enable row level security;

drop policy if exists "Users can view their own chat themes" on public.chat_themes;
create policy "Users can view their own chat themes"
  on public.chat_themes for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Users can upsert their own chat themes" on public.chat_themes;
create policy "Users can upsert their own chat themes"
  on public.chat_themes for insert
  to authenticated
  with check (auth.uid() = owner_id and owner_id <> partner_id);

drop policy if exists "Users can update their own chat themes" on public.chat_themes;
create policy "Users can update their own chat themes"
  on public.chat_themes for update
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Users can delete their own chat themes" on public.chat_themes;
create policy "Users can delete their own chat themes"
  on public.chat_themes for delete
  to authenticated
  using (auth.uid() = owner_id);

create trigger update_chat_themes_updated_at
  before update on public.chat_themes
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- 8) PUBLIC PROFILE VIEW (counts + last_seen masking)
-- Respects hide_last_seen; relies on profiles RLS for block visibility.
-- ============================================================================
create or replace view public.profiles_public
with (security_invoker = on) as
select
  p.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.created_at,
  case when p.hide_last_seen then null else p.last_seen end as last_seen,
  p.chat_accent,
  (select count(*)::int from public.follows f where f.followee_id = p.user_id) as followers_count,
  (select count(*)::int from public.follows f where f.follower_id = p.user_id) as following_count
from public.profiles p;

grant select on public.profiles_public to authenticated;

-- ============================================================================
-- 9) AVATAR STORAGE BUCKET (public read, per-user folder write)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 10) AUTO-CLEANUP: when A blocks B, remove their follow edges in both directions
-- ============================================================================
create or replace function public.cleanup_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_cleanup_follows on public.blocks;
create trigger blocks_cleanup_follows
  after insert on public.blocks
  for each row execute function public.cleanup_on_block();
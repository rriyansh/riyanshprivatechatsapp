-- =========================================================
-- GROUPS
-- =========================================================
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  avatar_url text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index idx_group_members_user on public.group_members(user_id);
create index idx_group_members_group on public.group_members(group_id);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null,
  content text not null,
  type text not null default 'text',
  reply_to_id uuid references public.group_messages(id) on delete set null,
  deleted_for_everyone boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_group_messages_group_created on public.group_messages(group_id, created_at desc);

-- Helper: is user a member of a group? SECURITY DEFINER avoids RLS recursion.
create or replace function public.is_group_member(_group uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group and user_id = _user
  );
$$;

create or replace function public.is_group_admin(_group uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group and user_id = _user and role = 'admin'
  );
$$;

-- Auto-add creator as admin
create or replace function public.add_group_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger trg_groups_add_creator
after insert on public.groups
for each row execute function public.add_group_creator_as_admin();

create trigger trg_groups_updated_at
before update on public.groups
for each row execute function public.update_updated_at_column();

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

-- groups
create policy "Members can view their groups"
on public.groups for select to authenticated
using (public.is_group_member(id, auth.uid()));

create policy "Authenticated users can create groups"
on public.groups for insert to authenticated
with check (auth.uid() = created_by);

create policy "Admins can update groups"
on public.groups for update to authenticated
using (public.is_group_admin(id, auth.uid()))
with check (public.is_group_admin(id, auth.uid()));

create policy "Admins can delete groups"
on public.groups for delete to authenticated
using (public.is_group_admin(id, auth.uid()));

-- group_members
create policy "Members can view group membership"
on public.group_members for select to authenticated
using (public.is_group_member(group_id, auth.uid()));

create policy "Admins or self can add members"
on public.group_members for insert to authenticated
with check (
  public.is_group_admin(group_id, auth.uid())
  or auth.uid() = user_id  -- creator self-add via trigger runs as definer; this also allows joining if app allows
);

create policy "Admins can remove anyone, members can remove themselves"
on public.group_members for delete to authenticated
using (
  public.is_group_admin(group_id, auth.uid())
  or auth.uid() = user_id
);

create policy "Admins can change roles"
on public.group_members for update to authenticated
using (public.is_group_admin(group_id, auth.uid()))
with check (public.is_group_admin(group_id, auth.uid()));

-- group_messages
create policy "Members can read group messages"
on public.group_messages for select to authenticated
using (public.is_group_member(group_id, auth.uid()));

create policy "Members can send group messages"
on public.group_messages for insert to authenticated
with check (
  auth.uid() = sender_id
  and public.is_group_member(group_id, auth.uid())
);

create policy "Senders can update their group messages"
on public.group_messages for update to authenticated
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

-- Realtime
alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.groups;

-- =========================================================
-- CALL SIGNALING (1:1 voice)
-- =========================================================
create table public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  from_user uuid not null,
  to_user uuid not null,
  kind text not null check (kind in ('offer','answer','ice','hangup','ring','reject')),
  payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);

create index idx_call_signals_to_user on public.call_signals(to_user, created_at desc);
create index idx_call_signals_call on public.call_signals(call_id);

alter table public.call_signals enable row level security;

create policy "Participants can read call signals"
on public.call_signals for select to authenticated
using (auth.uid() = to_user or auth.uid() = from_user);

create policy "Users can send signals as themselves"
on public.call_signals for insert to authenticated
with check (
  auth.uid() = from_user
  and from_user <> to_user
  and not public.is_blocked_between(from_user, to_user)
);

create policy "Participants can clean up signals"
on public.call_signals for delete to authenticated
using (auth.uid() = to_user or auth.uid() = from_user);

alter publication supabase_realtime add table public.call_signals;
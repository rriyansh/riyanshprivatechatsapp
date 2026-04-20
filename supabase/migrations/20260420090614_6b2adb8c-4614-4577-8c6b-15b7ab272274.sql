-- 1. delivered_at on messages
alter table public.messages
  add column if not exists delivered_at timestamptz;

-- 2. reactions table
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_message on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

-- View: only people who can see the underlying message can see its reactions
create policy "View reactions on visible messages"
on public.message_reactions
for select
to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id
      and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
      and not public.is_blocked_between(m.sender_id, m.receiver_id)
  )
);

create policy "Users add their own reactions"
on public.message_reactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id
      and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
      and not public.is_blocked_between(m.sender_id, m.receiver_id)
  )
);

create policy "Users remove their own reactions"
on public.message_reactions
for delete
to authenticated
using (auth.uid() = user_id);

-- 3. realtime
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.message_reactions;
  exception when duplicate_object then null;
  end;
end $$;
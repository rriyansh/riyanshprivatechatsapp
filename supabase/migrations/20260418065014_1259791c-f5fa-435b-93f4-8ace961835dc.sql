
-- 1) Add columns
alter table public.messages
  add column if not exists media_path text,
  add column if not exists media_duration_ms integer;

-- 2) Relax content length check to allow empty content when media is present
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages
  add constraint messages_content_check
  check (char_length(content) between 0 and 4000);

-- Require either content or media
alter table public.messages drop constraint if exists messages_content_or_media_check;
alter table public.messages
  add constraint messages_content_or_media_check
  check (char_length(content) > 0 or media_path is not null);

-- 3) Create private storage bucket for chat media
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

-- 4) Storage RLS policies
-- Path layout: <auth.uid()>/<message_uuid>.<ext>
-- Uploaders can write/read their own folder; recipients can read media that
-- belongs to a message they received.

-- Allow uploaders to insert into their own folder
drop policy if exists "Users can upload chat media to own folder" on storage.objects;
create policy "Users can upload chat media to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow uploaders to read their own folder
drop policy if exists "Users can read own chat media" on storage.objects;
create policy "Users can read own chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow uploaders to delete their own folder
drop policy if exists "Users can delete own chat media" on storage.objects;
create policy "Users can delete own chat media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow recipients to read media tied to a message they received
drop policy if exists "Recipients can read chat media" on storage.objects;
create policy "Recipients can read chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.messages m
      where m.media_path = storage.objects.name
        and m.receiver_id = auth.uid()
    )
  );

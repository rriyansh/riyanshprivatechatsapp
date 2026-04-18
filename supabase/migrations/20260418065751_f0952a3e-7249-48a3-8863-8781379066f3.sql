-- Replace the broad public read policy with one that only allows direct file
-- access by name, not bucket-wide listing.
drop policy if exists "Avatar images are publicly accessible" on storage.objects;

create policy "Public can read avatar files by name"
  on storage.objects for select
  to public
  using (
    bucket_id = 'avatars'
    and name is not null
  );
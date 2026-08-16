-- =============================================================================
-- NoHunger — 04_storage.sql
-- One bucket, one photo per donation, ~50 KB WebP.
-- Run AFTER functions.sql.
-- =============================================================================

-- Public read: the map has to render photos for logged-out visitors, and a
-- signed-URL round trip per marker is not worth it on the free tier. The bucket
-- holds nothing private: photos are re-encoded client-side, so EXIF and GPS are
-- already gone, and the object is deleted the moment the listing ends.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', true, 262144, array['image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read.
drop policy if exists "food images are publicly readable" on storage.objects;
create policy "food images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'food-images');

-- A signed-in user may only write inside their own uid folder: <uid>/<uuid>.webp
-- The app uploads server-side with the service role, which bypasses this. The
-- policy is here so that a direct client upload can never write outside its own
-- namespace or overwrite someone else's photo.
drop policy if exists "users write their own food images" on storage.objects;
create policy "users write their own food images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "users update their own food images" on storage.objects;
create policy "users update their own food images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Deletion is never done from the client. Objects are queued in public.storage_gc
-- and removed by /api/gc/images with the service-role key.
drop policy if exists "users delete their own food images" on storage.objects;
create policy "users delete their own food images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

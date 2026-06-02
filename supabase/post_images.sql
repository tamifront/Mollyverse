-- Фото для постов (только изображения)

alter table public.posts
  add column if not exists post_image_url text;

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "post_images_public_read" on storage.objects;
drop policy if exists "post_images_insert_own" on storage.objects;
drop policy if exists "post_images_update_own" on storage.objects;
drop policy if exists "post_images_delete_own" on storage.objects;

create policy "post_images_public_read"
on storage.objects for select
using (bucket_id = 'post-images');

create policy "post_images_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "post_images_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "post_images_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';

-- Разрешить всем авторизованным читать лайки (счётчики и список «кто лайкнул»)
-- Выполни в Supabase SQL Editor после fix_all.sql

drop policy if exists "post_likes_select_own" on public.post_likes;
drop policy if exists "post_likes_select_authenticated" on public.post_likes;

create policy "post_likes_select_authenticated"
on public.post_likes for select to authenticated
using (true);

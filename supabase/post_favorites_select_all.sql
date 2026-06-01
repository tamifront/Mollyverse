-- Разрешить всем авторизованным читать избранное (счётчики сохранений)
-- Выполни в Supabase SQL Editor после fix_all.sql

drop policy if exists "post_favorites_select_own" on public.post_favorites;
drop policy if exists "post_favorites_select_authenticated" on public.post_favorites;

create policy "post_favorites_select_authenticated"
on public.post_favorites for select to authenticated
using (true);

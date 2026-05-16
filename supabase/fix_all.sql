-- ============================================
-- Mollyverse: запусти ВЕСЬ файл в SQL Editor (New query → Run)
-- ============================================

-- 1) Колонки в posts
alter table public.posts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.posts
  add column if not exists post_source text not null default 'feed';

-- 2) Старые посты без автора — привязать к тебе (ЗАМЕНИ email на свой!)
-- update public.posts
-- set user_id = (select id from auth.users where email = 'ТВОЙ_EMAIL@example.com' limit 1)
-- where user_id is null;

-- 3) Чтобы посты появились в ЛЕНТЕ (все текущие сделать "из профиля")
update public.posts
set post_source = 'profile'
where post_source is null or post_source = 'feed';

-- 4) Права
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on table public.posts to authenticated;
grant select on table public.posts to anon;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.profiles to anon;

-- 5) RLS posts
alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;

create policy "posts_select_all"
on public.posts for select to authenticated
using (true);

create policy "posts_insert_own"
on public.posts for insert to authenticated
with check (auth.uid() = user_id);

create policy "posts_update_own"
on public.posts for update to authenticated
using (auth.uid() = user_id);

create policy "posts_delete_own"
on public.posts for delete to authenticated
using (auth.uid() = user_id);

-- 6) RLS profiles — ники видны всем залогиненным
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "profiles_select_all_authenticated"
on public.profiles for select to authenticated
using (true);

create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

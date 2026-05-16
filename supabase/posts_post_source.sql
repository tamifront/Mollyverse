-- Выполни в Supabase SQL Editor (New query), если колонки ещё нет
alter table public.posts
  add column if not exists post_source text not null default 'feed';

comment on column public.posts.post_source is 'profile = в ленте и профиле, feed = только в профиле';

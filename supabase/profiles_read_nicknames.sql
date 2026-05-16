-- Чтобы в ленте и поиске были видны ники всех пользователей (не только свой)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;

create policy "profiles_select_all_authenticated"
on public.profiles
for select
to authenticated
using (true);

-- ============================================
-- Обновления: публиковать может только владелица
-- Supabase → SQL Editor → Run (весь файл)
-- ============================================

-- Замени email, если нужен другой аккаунт-владелец
create or replace function public.is_mollyverse_owner()
returns boolean
language sql
security definer
stable
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = lower('tamilaismailova2012@gmail.com')
  );
$$;

revoke all on function public.is_mollyverse_owner() from public;
grant execute on function public.is_mollyverse_owner() to authenticated;

alter table public.updates enable row level security;

-- Все залогиненные могут читать
drop policy if exists "updates_select_authenticated" on public.updates;
create policy "updates_select_authenticated"
on public.updates for select to authenticated
using (true);

-- Писать, менять и удалять — только владелица
drop policy if exists "updates_insert_owner" on public.updates;
drop policy if exists "updates_update_owner" on public.updates;
drop policy if exists "updates_delete_owner" on public.updates;
drop policy if exists "updates_insert_authenticated" on public.updates;
drop policy if exists "updates_update_authenticated" on public.updates;
drop policy if exists "updates_delete_authenticated" on public.updates;

create policy "updates_insert_owner"
on public.updates for insert to authenticated
with check (public.is_mollyverse_owner());

create policy "updates_update_owner"
on public.updates for update to authenticated
using (public.is_mollyverse_owner())
with check (public.is_mollyverse_owner());

create policy "updates_delete_owner"
on public.updates for delete to authenticated
using (public.is_mollyverse_owner());

notify pgrst, 'reload schema';

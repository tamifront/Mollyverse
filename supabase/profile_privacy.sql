-- ============================================
-- Приватные аккаунты и запросы на подписку
-- Supabase → SQL Editor → Run (весь файл)
-- ============================================

alter table public.profiles
  add column if not exists is_private boolean not null default false;

create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (requester_id, target_id)
);

create index if not exists follow_requests_target_pending_idx
  on public.follow_requests (target_id)
  where status = 'pending';

alter table public.follow_requests enable row level security;

drop policy if exists "follow_requests_select_own" on public.follow_requests;
drop policy if exists "follow_requests_insert_own" on public.follow_requests;
drop policy if exists "follow_requests_update_target" on public.follow_requests;
drop policy if exists "follow_requests_delete_own" on public.follow_requests;

create policy "follow_requests_select_own"
on public.follow_requests for select to authenticated
using (auth.uid() = requester_id or auth.uid() = target_id);

create policy "follow_requests_insert_own"
on public.follow_requests for insert to authenticated
with check (
  auth.uid() = requester_id
  and requester_id <> target_id
);

create policy "follow_requests_update_target"
on public.follow_requests for update to authenticated
using (auth.uid() = target_id)
with check (auth.uid() = target_id);

create policy "follow_requests_delete_own"
on public.follow_requests for delete to authenticated
using (auth.uid() = requester_id or auth.uid() = target_id);

grant select, insert, update, delete on public.follow_requests to authenticated;

notify pgrst, 'reload schema';

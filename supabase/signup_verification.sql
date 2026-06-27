-- ============================================
-- Регистрация с email-кодом (Mollyverse)
-- Supabase → SQL Editor → New query → Run (весь файл)
-- ============================================

-- Проверка: email уже зарегистрирован (только service_role / edge functions)
create or replace function public.check_email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = auth, public
stable
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.check_email_registered(text) from public;
grant execute on function public.check_email_registered(text) to service_role;

-- Временные коды подтверждения (доступ только через Edge Functions + service_role)
create table if not exists public.signup_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists signup_verifications_email_idx
  on public.signup_verifications (email);

create index if not exists signup_verifications_expires_at_idx
  on public.signup_verifications (expires_at);

alter table public.signup_verifications enable row level security;

-- Клиент не имеет прямого доступа к таблице
revoke all on table public.signup_verifications from anon, authenticated;
grant all on table public.signup_verifications to service_role;

-- Очистка просроченных кодов (вызывается из Edge Function и cron)
create or replace function public.cleanup_expired_signup_verifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.signup_verifications
  where expires_at < now()
     or (locked_until is not null and locked_until < now() - interval '1 day');

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_signup_verifications() from public;
grant execute on function public.cleanup_expired_signup_verifications() to service_role;

-- Cron: удаление просроченных кодов каждый час
-- (включите расширение pg_cron: Dashboard → Database → Extensions)
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-signup-verifications') then
    perform cron.unschedule('cleanup-signup-verifications');
  end if;
end $$;

select cron.schedule(
  'cleanup-signup-verifications',
  '0 * * * *',
  $$select public.cleanup_expired_signup_verifications();$$
);

notify pgrst, 'reload schema';

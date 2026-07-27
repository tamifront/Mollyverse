-- Проверка: email свободен для регистрации (вызывается с фронта)
create or replace function public.is_email_available(p_email text)
returns boolean
language sql
security definer
set search_path = auth, public
stable
as $$
  select not exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.is_email_available(text) from public;
grant execute on function public.is_email_available(text) to anon, authenticated;

notify pgrst, 'reload schema';

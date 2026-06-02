-- ============================================
-- Синхронизация profiles с auth.users
-- Supabase → SQL Editor → New query → Run (весь файл)
-- ============================================

-- Колонки, если их ещё нет (age уже integer — не трогаем тип)
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists bio text default '';
alter table public.profiles add column if not exists avatar_url text default '';

-- Парсинг возраста из metadata (integer или null)
create or replace function public.parse_profile_age(meta jsonb)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(trim(meta->>'age'), '') ~ '^[0-9]+$'
      then (trim(meta->>'age'))::integer
    else null
  end;
$$;

-- 1) Создать профили для всех пользователей Auth, у кого их нет в profiles
insert into public.profiles (id, nickname, bio, avatar_url, age)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'user_' || left(replace(u.id::text, '-', ''), 8)
  ) as nickname,
  coalesce(nullif(trim(u.raw_user_meta_data->>'bio'), ''), '') as bio,
  coalesce(nullif(trim(u.raw_user_meta_data->>'avatar_url'), ''), '') as avatar_url,
  public.parse_profile_age(u.raw_user_meta_data) as age
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- 2) На будущее: при новой регистрации профиль создаётся автоматически
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, bio, avatar_url, age)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'user_' || left(replace(new.id::text, '-', ''), 8)
    ),
    coalesce(nullif(trim(new.raw_user_meta_data->>'bio'), ''), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''), ''),
    public.parse_profile_age(new.raw_user_meta_data)
  )
  on conflict (id) do update set
    nickname = coalesce(
      nullif(trim(excluded.nickname), ''),
      public.profiles.nickname
    );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Права и RLS (на всякий случай)
grant select, insert, update, delete on table public.profiles to authenticated;
grant select on table public.profiles to anon;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
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

-- 4) Проверка: у всех из Auth должен быть профиль
select
  u.id,
  u.email,
  u.created_at as auth_created,
  p.nickname,
  case when p.id is null then 'НЕТ ПРОФИЛЯ' else 'ok' end as status
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;

notify pgrst, 'reload schema';

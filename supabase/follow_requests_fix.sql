-- Как это работает? (How does it work?)

-- 1. Мы ставим уникальный индекс, чтобы нельзя было подписаться на одного человека больше одного раза:
create unique index if not exists follows_follower_following_idx
  on public.follows (follower_id, following_id);

-- 2. Когда кто-то отправил запрос на подписку (follow_requests), владелец профиля может его одобрить функцией:
--    public.approve_follow_request(p_request_id)
-- Функция работает так:
--   - Получает запрос из таблицы follow_requests по p_request_id и статусу 'pending' (на рассмотрении)
--   - Проверяет, что вы (автор запроса) являетесь владельцем профиля, на который хотят подписаться
--   - Если такой подписки ещё нет – создает запись в follows (то есть подписывает requester на ваш аккаунт)
--   - Отмечает статус запроса как 'approved' (одобрен)
create or replace function public.approve_follow_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.follow_requests%rowtype;
begin
  select * into v_request
  from public.follow_requests
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if auth.uid() is distinct from v_request.target_id then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.follows
    where follower_id = v_request.requester_id
      and following_id = v_request.target_id
  ) then
    insert into public.follows (follower_id, following_id)
    values (v_request.requester_id, v_request.target_id);
  end if;

  update public.follow_requests
  set status = 'approved'
  where id = p_request_id;
end;
$$;

-- Чтобы никто не мог пользоваться функцией кроме аутентифицированных пользователей:
revoke all on function public.approve_follow_request(uuid) from public;
grant execute on function public.approve_follow_request(uuid) to authenticated;

-- 3. Пользователь может повторно отправить запрос на подписку, если прошлый был отклонён или даже если уже был одобрен;
--    это делается policy (SQL правило) на update строки в follow_requests — оно проверяет:
--   - вы автор запроса (requester),
--   - статус запроса был rejected/approved (то есть не pending)
--   - можно обновить статус на 'pending' (повторно подать запрос)
drop policy if exists "follow_requests_update_requester_retry" on public.follow_requests;

create policy "follow_requests_update_requester_retry"
on public.follow_requests for update to authenticated
using (
  auth.uid() = requester_id
  and status in ('rejected', 'approved')
)
with check (
  auth.uid() = requester_id
  and status = 'pending'
);

-- После изменений — команда для Supabase, чтобы применить обновления в API:
notify pgrst, 'reload schema';

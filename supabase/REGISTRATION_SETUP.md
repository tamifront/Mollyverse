# Mollyverse — регистрация с email-кодом

Стек: **React + Vite**, **Supabase** (Auth, Postgres, Edge Functions), **Resend** (отправка писем).

## 1. SQL-миграция

В Supabase Dashboard → **SQL Editor** выполните файл:

`supabase/signup_verification.sql`

Также включите расширение **pg_cron** (Database → Extensions), если cron ещё не активен.

## 2. Resend

1. Создайте аккаунт на [resend.com](https://resend.com)
2. Добавьте и подтвердите домен (или используйте `onboarding@resend.dev` для тестов)
3. Скопируйте API-ключ

## 3. Деплой Edge Functions

Установите [Supabase CLI](https://supabase.com/docs/guides/cli) и [Deno](https://deno.land/) (или используйте `npx deno`).

### IDE (если `supabase.ts` / `index.ts` подсвечиваются красным)

1. Установите расширение **Deno** (`denoland.vscode-deno`) — Cursor предложит его из `.vscode/extensions.json`
2. Перезагрузите окно: `Ctrl+Shift+P` → **Developer: Reload Window**
3. В проекте уже есть `supabase/functions/deno.json` и `.vscode/settings.json`

Проверка синтаксиса локально:

```bash
npx deno check --config supabase/functions/deno.json supabase/functions/confirm-signup/index.ts
```

### Деплой на Supabase

```bash
supabase login
supabase link --project-ref khlzwhcmsicxnlvwdmer

supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="Mollyverse <noreply@yourdomain.com>"

supabase functions deploy request-signup-code --no-verify-jwt
supabase functions deploy confirm-signup --no-verify-jwt
```

`--no-verify-jwt` нужен, чтобы неавторизованные пользователи могли регистрироваться.

## 4. Запуск фронтенда

```bash
npm install
npm run dev
```

## Поведение

| Сценарий | Поведение |
|----------|-----------|
| Регистрация | email + пароль → код на почту → подтверждение → авто-вход |
| Вход | email + пароль (без кода) |
| Повторная отправка | через 60 с, старый код аннулируется |
| Срок кода | 15 минут |
| Брутфорс | 5 попыток → блокировка 5 минут |
| Очистка БД | cron каждый час |
| Старые пользователи | вход без изменений |

## Файлы

- `supabase/signup_verification.sql` — таблица, RLS, cron
- `supabase/functions/request-signup-code/` — отправка кода
- `supabase/functions/confirm-signup/` — проверка кода и создание аккаунта
- `src/utils/authRegistration.js` — вызовы API с фронта
- `src/pages/Login.jsx` — UI входа и регистрации

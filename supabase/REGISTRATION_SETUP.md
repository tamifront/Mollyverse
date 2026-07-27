# Регистрация — простая настройка (без Brevo и Resend)

Письма с кодом отправляет **сам Supabase**. Никаких сторонних сервисов.

## Шаг 1 — один раз в Supabase Dashboard

1. Открой [supabase.com/dashboard](https://supabase.com/dashboard) → проект Mollyverse
2. **Authentication** → **Sign In / Providers** → **Email**
3. Включи **Enable Email provider**
4. Включи **Confirm email** (если выключено)
5. Сохрани

## Шаг 2 — SQL (один раз)

**SQL Editor** → выполни файл `supabase/is_email_available.sql`

(Если уже делала `signup_verification.sql` — всё равно выполни этот, он короткий.)

## Шаг 3 — готово

```bash
npm run dev
```

Регистрация работает на **любой email**. Код приходит от Supabase (`noreply@mail.app.supabase.io`).

Проверь папку **Спам**, если письма нет.

---

## Вход для старых пользователей

Без изменений: **Вход** → email + пароль.

---

## Лимиты

На бесплатном тарифе Supabase ~3–4 письма в час на один адрес. Для большого трафика позже можно подключить свой SMTP в **Project Settings → Auth → SMTP**.

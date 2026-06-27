import { supabase, supabaseUrl, supabaseKey } from "../lib/supabase"

const FUNCTIONS_BASE = `${supabaseUrl}/functions/v1`

async function callFunction(name, body) {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify(body),
  })

  let data = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  return { ok: res.ok, status: res.status, data }
}

export async function requestSignupCode(email) {
  return callFunction("request-signup-code", { email: email.trim().toLowerCase() })
}

export async function confirmSignup(email, code, password) {
  return callFunction("confirm-signup", {
    email: email.trim().toLowerCase(),
    code: code.trim(),
    password,
  })
}

export async function loginWithPassword(email, password) {
  return supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
}

export function mapSignupError(data, status) {
  if (data?.message) return data.message

  switch (data?.error) {
    case "EMAIL_EXISTS":
      return "Пользователь с такой почтой уже существует"
    case "INVALID_CODE":
      return "Код неверный. Попробуйте ещё раз"
    case "EXPIRED":
    case "NO_CODE":
      return "Код истёк. Запросите новый"
    case "LOCKED":
      return "Слишком много попыток. Попробуйте через 5 минут"
    case "INVALID_EMAIL":
      return "Некорректный email"
    case "WEAK_PASSWORD":
      return "Пароль слишком короткий (минимум 6 символов)"
    case "EMAIL_SEND_FAILED":
      return "Не удалось отправить письмо. Попробуйте позже"
    case "EMAIL_NOT_CONFIGURED":
      return "Отправка писем не настроена на сервере"
    default:
      if (status >= 500) return "Ошибка сервера. Попробуйте позже"
      return "Произошла ошибка"
  }
}

export function mapLoginError(error) {
  if (!error) return ""
  const msg = (error.message || "").toLowerCase()
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    error.status === 400
  ) {
    return "пароль неверный"
  }
  if (msg.includes("unable to validate email")) {
    return "Некорректный email"
  }
  return error.message || "Произошла ошибка"
}

import { supabase } from "../lib/supabase"

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function mapAuthError(error) {
  if (!error) return { message: "Произошла ошибка" }
  const msg = (error.message || "").toLowerCase()

  if (msg.includes("already registered") || msg.includes("already exists")) {
    return { error: "EMAIL_EXISTS", message: "Пользователь с такой почтой уже существует" }
  }
  if (msg.includes("invalid") || msg.includes("credentials")) {
    return { error: "INVALID_CREDENTIALS", message: "Неверный email или пароль" }
  }
  if (msg.includes("password") && msg.includes("short")) {
    return { error: "WEAK_PASSWORD", message: "Пароль слишком короткий (минимум 6 символов)" }
  }
  if (msg.includes("signup") && msg.includes("disabled")) {
    return { error: "SIGNUP_DISABLED", message: "Регистрация отключена в настройках Supabase" }
  }
  return { message: error.message || "Произошла ошибка" }
}

export async function registerUser(email, password) {
  try {
    const normalized = normalizeEmail(email)

    if (password.length < 6) {
      return {
        ok: false,
        status: 400,
        data: { error: "WEAK_PASSWORD", message: "Пароль слишком короткий (минимум 6 символов)" }
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password: password,
    })

    if (error) {
      const mapped = mapAuthError(error)
      return { ok: false, status: 400, data: mapped }
    }

    return {
      ok: true,
      data: { user_id: data.user?.id, email: data.user?.email }
    }
  } catch (err) {
    console.error("❌ Ошибка регистрации:", err)
    return {
      ok: false,
      status: 500,
      data: { error: "SERVER_ERROR", message: "Ошибка сервера. Попробуйте позже" }
    }
  }
}

export async function loginWithPassword(email, password) {
  try {
    return await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
  } catch (err) {
    console.error("❌ Ошибка входа:", err)
    return { error: err }
  }
}

export function mapSignupError(data, status) {
  if (data?.message) return data.message
  switch (data?.error) {
    case "EMAIL_EXISTS": return "Пользователь с такой почтой уже существует"
    case "INVALID_CREDENTIALS": return "Неверный email или пароль"
    case "WEAK_PASSWORD": return "Пароль слишком короткий (минимум 6 символов)"
    case "SIGNUP_DISABLED": return "Регистрация отключена в настройках Supabase"
    default:
      if (status >= 500) return "Ошибка сервера. Попробуйте позже"
      return "Произошла ошибка"
  }
}

export function mapLoginError(error) {
  if (!error) return ""
  const msg = (error.message || "").toLowerCase()
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials") || error.status === 400) {
    return "Пароль неверный"
  }
  if (msg.includes("unable to validate email")) {
    return "Некорректный email"
  }
  return error.message || "Произошла ошибка"
}
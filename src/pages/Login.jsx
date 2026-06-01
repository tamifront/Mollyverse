import "../styles/Login.css"
import { useState } from "react"
import { supabase } from "../lib/supabase"

function mapAuthError(error, context) {
  if (!error) return ""
  const msg = (error.message || "").toLowerCase()
  if (
    context === "login" &&
    (msg.includes("invalid login credentials") ||
      msg.includes("invalid credentials") ||
      error.status === 400)
  ) {
    return "пароль неверный"
  }
  if (msg.includes("user already registered")) {
    return "Этот email уже зарегистрирован"
  }
  if (msg.includes("password") && msg.includes("short")) {
    return "Пароль слишком короткий (минимум 6 символов)"
  }
  if (msg.includes("unable to validate email")) {
    return "Некорректный email"
  }
  return error.message || "Произошла ошибка"
}

export default function Login() {
  const [mode, setMode] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function login(e) {
    e?.preventDefault()
    setError("")
    setSuccess("")

    if (!email.trim() || !password) {
      setError("Введите email и пароль")
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (authError) {
      setError(mapAuthError(authError, "login"))
      return
    }

    setSuccess("Добро пожаловать в Mollyverse!")
  }

  async function register(e) {
    e?.preventDefault()
    setError("")
    setSuccess("")

    const trimmedNick = nickname.trim()
    if (!email.trim() || !password) {
      setError("Введите email и пароль")
      return
    }
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов")
      return
    }
    if (trimmedNick.length < 2) {
      setError("Ник должен быть не короче 2 символов")
      return
    }
    if (age && (Number(age) < 1 || Number(age) > 120)) {
      setError("Укажите корректный возраст (1–120)")
      return
    }

    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (signUpError) {
      setLoading(false)
      setError(mapAuthError(signUpError, "register"))
      return
    }

    const { data: userData, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (loginError) {
      setLoading(false)
      setError(
        "Аккаунт создан. Подтверди email в почте (если требуется) и войди вручную."
      )
      setMode("login")
      return
    }

    const authUser = userData?.user
    if (!authUser) {
      setLoading(false)
      setError("Не удалось получить данные пользователя")
      return
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUser.id,
      nickname: trimmedNick,
      age: age ? String(age) : "",
      avatar_url: "",
    })

    setLoading(false)

    if (profileError) {
      setError(profileError.message || "Аккаунт создан, но профиль не сохранился")
      return
    }

    setSuccess("Аккаунт создан! Добро пожаловать в Mollyverse 🚀")
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Mollyverse</h1>

        <div className="login-tabs">
          <button
            type="button"
            className={mode === "login" ? "login-tab active" : "login-tab"}
            onClick={() => {
              setMode("login")
              setError("")
              setSuccess("")
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === "register" ? "login-tab active" : "login-tab"}
            onClick={() => {
              setMode("register")
              setError("")
              setSuccess("")
            }}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={mode === "login" ? login : register}>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError("")
            }}
            autoComplete="email"
            disabled={loading}
          />

          <input
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError("")
            }}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={loading}
          />

          {mode === "register" && (
            <>
              <input
                placeholder="Ник (минимум 2 символа)"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value)
                  setError("")
                }}
                minLength={2}
                maxLength={32}
                disabled={loading}
              />

              <input
                placeholder="Возраст (необязательно)"
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => {
                  setAge(e.target.value)
                  setError("")
                }}
                disabled={loading}
              />
            </>
          )}

          {error && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}

          <button type="submit" disabled={loading}>
            {loading
              ? "Загрузка..."
              : mode === "login"
                ? "Войти"
                : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  )
}

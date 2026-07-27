import "../styles/Login.css"
import { useState } from "react"
import {
  registerUser,
  loginWithPassword,
  mapSignupError,
  mapLoginError,
} from "../utils/authRegistration"

export default function Login() {
  const [mode, setMode] = useState("login") // "login" | "register"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const resetMessages = () => {
    setError("")
    setSuccess("")
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    resetMessages()
    setEmail("")
    setPassword("")
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!email.trim() || !password) {
      setError("Введите email и пароль")
      return
    }

    setLoading(true)
    const { error: authError } = await loginWithPassword(email, password)
    setLoading(false)

    if (authError) {
      setError(mapLoginError(authError))
      return
    }

    setSuccess("Добро пожаловать в Mollyverse!")
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!email.trim() || !password) {
      setError("Введите email и пароль")
      return
    }
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов")
      return
    }

    setLoading(true)
    const result = await registerUser(email, password)
    setLoading(false)

    if (!result.ok) {
      setError(mapSignupError(result.data, result.status))
      return
    }

    setSuccess("Аккаунт создан! Добро пожаловать в Mollyverse 🚀")
    setEmail("")
    setPassword("")
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Mollyverse</h1>

        <div className="login-tabs">
          <button
            type="button"
            className={mode === "login" ? "login-tab active" : "login-tab"}
            onClick={() => switchMode("login")}
            disabled={loading}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === "register" ? "login-tab active" : "login-tab"}
            onClick={() => switchMode("register")}
            disabled={loading}
          >
            Регистрация
          </button>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
            <input
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
            {error && <p className="login-error">{error}</p>}
            {success && <p className="login-success">{success}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Загрузка..." : "Войти"}
            </button>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister}>
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
            <input
              placeholder="Пароль (минимум 6 символов)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            {error && <p className="login-error">{error}</p>}
            {success && <p className="login-success">{success}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
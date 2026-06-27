import "../styles/Login.css"
import { useState, useEffect, useCallback } from "react"
import {
  requestSignupCode,
  confirmSignup,
  loginWithPassword,
  mapSignupError,
  mapLoginError,
} from "../utils/authRegistration"

const RESEND_COOLDOWN_SEC = 60

export default function Login() {
  const [mode, setMode] = useState("login")
  const [registerStep, setRegisterStep] = useState(1)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendSeconds])

  const resetMessages = useCallback(() => {
    setError("")
    setSuccess("")
  }, [])

  function switchMode(nextMode) {
    setMode(nextMode)
    setRegisterStep(1)
    setCode("")
    setResendSeconds(0)
    resetMessages()
  }

  async function handleLogin(e) {
    e?.preventDefault()
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

  async function sendCode(isResend = false) {
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
    const { ok, status, data } = await requestSignupCode(email)
    setLoading(false)

    if (!ok) {
      setError(mapSignupError(data, status))
      return
    }

    setRegisterStep(2)
    setCode("")
    setResendSeconds(data.resend_cooldown_seconds ?? RESEND_COOLDOWN_SEC)

    if (isResend) {
      setSuccess("Новый код отправлен на почту")
    }
  }

  async function handleRegisterStart(e) {
    e?.preventDefault()
    await sendCode(false)
  }

  async function handleResend() {
    if (resendSeconds > 0 || loading) return
    await sendCode(true)
  }

  async function handleConfirmCode(e) {
    e?.preventDefault()
    resetMessages()

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Код неверный. Попробуйте ещё раз")
      return
    }

    setLoading(true)
    const { ok, status, data } = await confirmSignup(email, code, password)
    setLoading(false)

    if (!ok) {
      setError(mapSignupError(data, status))
      return
    }

    setLoading(true)
    const { error: authError } = await loginWithPassword(email, password)
    setLoading(false)

    if (authError) {
      setSuccess("Аккаунт создан! Войдите с email и паролем.")
      setMode("login")
      setRegisterStep(1)
      return
    }

    setSuccess("Аккаунт создан! Добро пожаловать в Mollyverse 🚀")
  }

  function handleCodeChange(value) {
    const digits = value.replace(/\D/g, "").slice(0, 6)
    setCode(digits)
    setError("")
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

        {mode === "register" && registerStep === 1 && (
          <form onSubmit={handleRegisterStart}>
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
              placeholder="Пароль (минимум 6 символов)"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError("")
              }}
              autoComplete="new-password"
              disabled={loading}
            />

            {error && <p className="login-error">{error}</p>}
            {success && <p className="login-success">{success}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Отправка кода..." : "Получить код на почту"}
            </button>
          </form>
        )}

        {mode === "register" && registerStep === 2 && (
          <form onSubmit={handleConfirmCode}>
            <p className="login-hint">
              Код отправлен на <strong>{email}</strong>. Введите 6 цифр из письма.
              Код действует 15 минут.
            </p>

            <input
              className="login-code-input"
              placeholder="000000"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              autoComplete="one-time-code"
              disabled={loading}
            />

            {error && <p className="login-error">{error}</p>}
            {success && <p className="login-success">{success}</p>}

            <button type="submit" disabled={loading || code.length !== 6}>
              {loading ? "Проверка..." : "Подтвердить и создать аккаунт"}
            </button>

            <div className="login-resend-row">
              <button
                type="button"
                className="login-link-btn"
                onClick={handleResend}
                disabled={loading || resendSeconds > 0}
              >
                {resendSeconds > 0
                  ? `Отправить снова (${resendSeconds} с)`
                  : "Отправить снова"}
              </button>
              <button
                type="button"
                className="login-link-btn"
                onClick={() => {
                  setRegisterStep(1)
                  setCode("")
                  resetMessages()
                }}
                disabled={loading}
              >
                Изменить email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

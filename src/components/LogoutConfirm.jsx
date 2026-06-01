import { useState } from "react"
import { supabase } from "../lib/supabase"
import "../styles/LogoutConfirm.css"

export default function LogoutConfirm({ user, open, onClose }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleLogout(e) {
    e.preventDefault()
    setError("")

    if (!password.trim()) {
      setError("Введите пароль для выхода")
      return
    }

    if (!user?.email) {
      setError("Не удалось определить email аккаунта")
      return
    }

    setLoading(true)
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    setLoading(false)

    if (verifyError) {
      const msg = (verifyError.message || "").toLowerCase()
      if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid credentials") ||
        verifyError.status === 400
      ) {
        setError("пароль неверный")
      } else {
        setError(verifyError.message || "Не удалось проверить пароль")
      }
      return
    }

    await supabase.auth.signOut()
    setPassword("")
    onClose()
  }

  function handleClose() {
    setPassword("")
    setError("")
    onClose()
  }

  return (
    <div className="logout-overlay" onClick={handleClose}>
      <form
        className="logout-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleLogout}
      >
        <h2>Выйти из аккаунта</h2>
        <p className="logout-hint">Для выхода введите свой пароль</p>
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError("")
          }}
          autoComplete="current-password"
          disabled={loading}
        />
        {error && <p className="logout-error">{error}</p>}
        <div className="logout-actions">
          <button type="button" className="logout-cancel" onClick={handleClose} disabled={loading}>
            Отмена
          </button>
          <button type="submit" className="logout-submit" disabled={loading}>
            {loading ? "Проверка..." : "Выйти"}
          </button>
        </div>
      </form>
    </div>
  )
}

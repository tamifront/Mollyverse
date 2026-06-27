import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { formatKZDate } from "../utils/datetime"
import { markUpdatesAsRead } from "../utils/updatesUnread"
import "../styles/Updates.css"

const OWNER_EMAIL = (
  import.meta.env.VITE_OWNER_EMAIL || "tamilaismailova2012@gmail.com"
).trim().toLowerCase()

export default function Updates({ user, onUpdatesChange }) {
  const [updates, setUpdates] = useState([])
  const [text, setText] = useState("")

  const canPublish = useMemo(() => {
    if (!user?.id) return false
    return user.email?.trim().toLowerCase() === OWNER_EMAIL
  }, [user?.id, user?.email])

  async function loadUpdates() {
    const { data, error } = await supabase
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      alert(error.message || "Не удалось загрузить обновления")
      return
    }
    setUpdates(data || [])
  }

  useEffect(() => {
    loadUpdates()
  }, [])

  const latestCreatedAt = updates[0]?.created_at

  useEffect(() => {
    if (!user?.id || !latestCreatedAt) return
    markUpdatesAsRead(user.id, latestCreatedAt)
  }, [user?.id, latestCreatedAt])

  async function createUpdate() {
    if (!canPublish) {
      alert("Публиковать обновления может только владелица аккаунта")
      return
    }
    if (!text.trim()) return

    const { error } = await supabase.from("updates").insert({
      user_id: user.id,
      content: text.trim(),
    })
    if (error) {
      alert(error.message || "Не удалось опубликовать обновление")
      return
    }
    setText("")
    await loadUpdates()
    onUpdatesChange?.()
    window.dispatchEvent(new CustomEvent("updates-published"))
  }

  return (
    <div className="updates-page">
      <header className="updates-header">
        <h1>Обновления</h1>
      </header>

      <div className="mv-panel updates-compose">
        {canPublish ? (
          <>
            <textarea
              className="mv-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что нового в Mollyverse..."
            />
            <div className="mv-form-actions">
              <button type="button" className="mv-btn mv-btn--primary" onClick={createUpdate}>
                Опубликовать
              </button>
            </div>
          </>
        ) : (
          <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>
            Публиковать обновления может только владелица аккаунта.
          </p>
        )}
      </div>

      <div className="updates-list">
        {updates.length === 0 && <p className="mv-empty">Пока обновлений нет.</p>}
        {updates.map((item) => (
          <article key={item.id} className="mv-panel updates-card">
            <time className="updates-card-date">{formatKZDate(item.created_at)}</time>
            <p className="updates-card-text">{item.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

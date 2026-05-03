import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { formatKZDate } from "../utils/datetime"

const OWNER_USER_ID = (import.meta.env.VITE_OWNER_USER_ID || "").trim()

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #232946 0%, #1a1a22 100%)",
    padding: "24px 0",
    color: "#fff",
  },
  title: {
    fontWeight: 800,
    fontSize: 32,
    margin: "0 0 24px 0",
    textAlign: "center",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "rgba(34,39,46,0.94)",
    borderRadius: 12,
    maxWidth: 620,
    margin: "0 auto 22px auto",
    padding: "18px 20px",
  },
  input: {
    borderRadius: 8,
    border: "1px solid rgba(255,69,0,0.2)",
    padding: "12px 13px",
    fontSize: 16,
    background: "rgba(0,0,0,0.23)",
    color: "#fff",
    outline: "none",
    minHeight: 86,
    resize: "vertical",
  },
  button: {
    background: "#2563eb",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 16px",
    fontWeight: 700,
    alignSelf: "flex-end",
  },
  posts: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 620,
    margin: "0 auto",
  },
  card: {
    background: "rgba(34,39,46,0.98)",
    borderRadius: 14,
    border: "1px solid rgba(255,69,0,0.13)",
    padding: "16px 18px",
  },
  date: {
    color: "#9aa6bc",
    fontSize: 13,
    marginBottom: 8,
  },
}

export default function Updates({ user }) {
  const [updates, setUpdates] = useState([])
  const [text, setText] = useState("")

  const canPublish = useMemo(() => {
    if (!user?.id) return false
    if (!OWNER_USER_ID) return true
    return OWNER_USER_ID === user.id
  }, [user?.id])

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
    loadUpdates()
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📢 Обновления</h1>

      <div style={styles.panel}>
        {canPublish ? (
          <>
            <textarea
              style={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Напиши, что нового в Mollyverse..."
            />
            <button style={styles.button} onClick={createUpdate}>
              Опубликовать
            </button>
          </>
        ) : (
          <p style={{ margin: 0, color: "#d7d7d7" }}>
            Публиковать обновления может только владелица аккаунта.
          </p>
        )}
      </div>

      <div style={styles.posts}>
        {updates.length === 0 && <p>Пока обновлений нет.</p>}
        {updates.map((item) => (
          <div key={item.id} style={styles.card}>
            <div style={styles.date}>{formatKZDate(item.created_at)}</div>
            <div>{item.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

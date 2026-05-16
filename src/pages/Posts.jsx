import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { POST_SOURCE_FEED, POST_SOURCE_PROFILE, isVisibleInFeed } from "../utils/postSource"
import { fetchNicknamesByUserIds, getPostAuthorNickname } from "../utils/profiles"

// Чистый Казахстанский формат времени: день.месяц.год часы:минуты (по времени Алматы/КЗ)
function formatKZDateAlmaty(dt) {
  if (!dt) return ""
  // Преобразуем в Date если строка
  const date = typeof dt === "string" ? new Date(dt) : dt
  // UTC+6 для Алматы
  const offsetMillis = 6 * 60 * 60 * 1000
  const kzTime = new Date(date.getTime() + offsetMillis)
  const day = String(kzTime.getUTCDate()).padStart(2, "0")
  const month = String(kzTime.getUTCMonth() + 1).padStart(2, "0")
  const year = kzTime.getUTCFullYear()
  const hours = String(kzTime.getUTCHours()).padStart(2, "0")
  const mins = String(kzTime.getUTCMinutes()).padStart(2, "0")
  return `${day}.${month}.${year} ${hours}:${mins}`
}

const redditCardStyles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #232946 0%, #1a1a22 100%)',
    padding: '32px 0'
  },
  pageTitle: {
    fontWeight: 800,
    fontSize: 32,
    margin: "0 0 36px 0",
    color: "#fff",
    textAlign: "center",
    letterSpacing: "1px",
    textShadow: "0 2px 10px rgba(30,0,10,0.10)"
  },
  newPostForm: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "rgba(34,39,46,0.94)",
    borderRadius: 12,
    maxWidth: 540,
    margin: "0 auto 28px auto",
    padding: "22px 24px 18px 24px",
    boxShadow: "0 4px 24px 0 rgba(0,0,0,0.13), 0 1.5px 10px 0 rgba(255,0,20,0.04)"
  },
  input: {
    borderRadius: 8,
    border: "1.2px solid rgba(255,69,0,0.18)",
    padding: "12px 13px",
    fontSize: 18,
    background: "rgba(0,0,0,0.23)",
    color: "#fff",
    outline: "none",
    marginBottom: 3
  },
  button: {
    background: "#20232f",
    border: "1.5px solid rgba(255,0,30,0.18)",
    color: "#fff",
    borderRadius: 7,
    cursor: "pointer",
    padding: "7px 21px",
    fontWeight: 700,
    fontSize: 16,
    alignSelf: "flex-end",
    transition: "background .14s, border .14s"
  },
  postsContainer: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 26,
    width: "100%",
    maxWidth: 620,
    marginLeft: "auto",
    marginRight: "auto"
  },
  card: {
    background: "rgba(34,39,46,0.98)",
    borderRadius: 14,
    boxShadow: "0 4px 22px 0 rgba(0,0,0,0.13), 0 1.5px 10px 0 rgba(255,0,20,0.04)",
    border: "1px solid rgba(255,69,0,0.13)",
    padding: "24px 28px 18px 22px",
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    position: "relative",
    transition: "box-shadow .13s"
  },
  voting: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginRight: 14,
    marginTop: 4
  },
  content: {
    flex: 1,
    fontSize: 18,
    color: "#ecebed",
    marginBottom: 12,
    wordBreak: "break-word",
    whiteSpace: "pre-line"
  },
  date: {
    color: "#96a0b5",
    fontSize: 13,
    marginBottom: 8,
  },
  author: {
    color: "#aac6f6",
    fontWeight: 700,
    fontSize: 16,
    marginBottom: 4
  }
}

export default function Posts({ user }) {
  const [posts, setPosts] = useState([])
  const [text, setText] = useState("")
  const [profilesById, setProfilesById] = useState({})

  async function loadPosts() {
    const { data: allPosts, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setPosts([])
      setProfilesById({})
      return
    }

    const postsData = (allPosts || []).filter(isVisibleInFeed)
    setPosts(postsData)

    const userIds = postsData.map((p) => p.user_id).filter(Boolean)
    if (user?.id && !userIds.includes(user.id)) userIds.push(user.id)

    const { data: allProfiles } = await supabase.from("profiles").select("id, nickname")
    const mapping = {}
    for (const p of allProfiles || []) {
      mapping[p.id] = p.nickname?.trim() || "без ника"
    }
    const fromIds = await fetchNicknamesByUserIds(userIds)
    setProfilesById({ ...mapping, ...fromIds })
  }

  useEffect(() => {
    loadPosts()
  }, [user?.id])

  async function createPost() {
    if (!user?.id) {
      alert("Войдите в аккаунт")
      return
    }
    if (!text.trim()) {
      alert("Пост не может быть пустым.")
      return
    }
    const payload = {
      content: text.trim(),
      user_id: user.id,
      post_source: POST_SOURCE_FEED,
    }
    let { error } = await supabase.from("posts").insert(payload)
    if (error) {
      const { error: fallbackError } = await supabase.from("posts").insert({
        content: text.trim(),
        user_id: user.id,
      })
      error = fallbackError
    }

    if (error) {
      alert(error.message)
      return
    }

    setText("")
    await loadPosts()
  }

  return (
    <div style={redditCardStyles.container}>
      <h1 style={redditCardStyles.pageTitle}>📰 Посты</h1>

      <form
        style={redditCardStyles.newPostForm}
        onSubmit={e => {
          e.preventDefault()
          createPost()
        }}
      >
        <textarea
          style={redditCardStyles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что у тебя нового?"
          rows={3}
        />
        <button
          type="submit"
          style={{
            ...redditCardStyles.button,
            opacity: !text.trim() ? 0.5 : 1,
            pointerEvents: !text.trim() ? "none" : "auto"
          }}
          disabled={!text.trim()}
        >
          💾 Сохранить
        </button>
      </form>

      <div style={redditCardStyles.postsContainer}>
        {posts.map((p) => (
          <div key={p.id} style={redditCardStyles.card}>
            <div style={redditCardStyles.voting}>
              <span style={{
                fontSize: 25,
                color: "#ff4157",
                fontWeight: 700,
                marginTop: 3,
                marginBottom: 3,
                userSelect: "none"
              }}>▲</span>
              <span style={{
                fontWeight: 700,
                fontSize: 16,
                color: "#ff4157"
              }}>{p.likes ?? 0}</span>
              <span style={{
                fontSize: 23,
                color: "#666",
                fontWeight: 600,
                marginTop: 4,
                userSelect: "none"
              }}>▼</span>
            </div>
            <div style={{flex: 1, display: "flex", flexDirection: "column"}}>
              {/* Ник автора */}
              <div style={redditCardStyles.author}>
                {getPostAuthorNickname(p, profilesById, user)}
              </div>
              <div style={redditCardStyles.date}>
                {formatKZDateAlmaty(p.created_at)}
              </div>
              <div style={redditCardStyles.content}>
                {p.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
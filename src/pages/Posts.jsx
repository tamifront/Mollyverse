import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { POST_SOURCE_FEED, POST_SOURCE_PROFILE, isVisibleInFeed } from "../utils/postSource"
import { getPostAuthorNickname, loadAllNicknamesMap } from "../utils/profiles"
import { usePostReactions } from "../hooks/usePostReactions"

// Правильное казахстанское время: день.месяц.год часы:минуты (Asia/Almaty, UTC+6, с учётом переходов и нормальное время вне зависимости от локали)
function formatKZDateAlmaty(dt) {
  if (!dt) return ""
  try {
    let dateObj
    if (typeof dt === "string") {
      // ISO датастроки из супабейса, без таймзоны — считаем что это UTC (или local но обычно UTC)
      // если есть "Z" (UTC), то new Date(dt) - норм
      // если нет "Z", то Date.parse воспринимает как local, но Supabase хранит в UTC
      // Поэтому: нормализуем всегда к UTC, потом представим в алматинское время
      if (!dt.endsWith("Z") && !dt.includes("+")) {
        // добавим Z если нет, иначе как local (неправильно)
        dateObj = new Date(dt + "Z")
      } else {
        dateObj = new Date(dt)
      }
    } else if (dt instanceof Date) {
      dateObj = dt
    } else {
      return ""
    }

    // Используем Intl.DateTimeFormat чтобы получить реальное время в Алматы (учитывает летнее/зимнее и прочее)
    // Но fallback для node <14
    try {
      const options = {
        timeZone: "Asia/Almaty",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
      // "dd.mm.yyyy, HH:MM"
      const parts = new Intl.DateTimeFormat("ru-RU", options).formatToParts(dateObj)
      const get = type => parts.find(p => p.type === type)?.value ?? ""
      // Порядок: день.месяц.год часы:минуты
      return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`
    } catch (e) {
      // fallback если Intl.DateTimeFormat не поддерживает таймзоны
      // смещаем время вручную на +6 часов к UTC
      const utc = dateObj.getTime()
      const tzDateObj = new Date(utc + 6 * 60 * 60 * 1000)
      const day = String(tzDateObj.getUTCDate()).padStart(2, "0")
      const month = String(tzDateObj.getUTCMonth() + 1).padStart(2, "0")
      const year = tzDateObj.getUTCFullYear()
      const hours = String(tzDateObj.getUTCHours()).padStart(2, "0")
      const mins = String(tzDateObj.getUTCMinutes()).padStart(2, "0")
      return `${day}.${month}.${year} ${hours}:${mins}`
    }
  } catch (e) {
    return ""
  }
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
  },
  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    alignItems: "center",
    marginTop: 8,
    fontSize: 17
  }
}

export default function Posts({ user }) {
  const [posts, setPosts] = useState([])
  const [text, setText] = useState("")
  const [profilesById, setProfilesById] = useState({})
  const [loadError, setLoadError] = useState("")
  const {
    likedPostIds,
    favoritePostIds,
    toggleLike,
    toggleFavorite,
  } = usePostReactions(user)

  async function loadPosts() {
    const { data: allPosts, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setLoadError(error.message || "Не удалось загрузить посты")
      setPosts([])
      setProfilesById({})
      return
    }
    setLoadError("")

    setPosts((allPosts || []).filter(isVisibleInFeed))
    setProfilesById(await loadAllNicknamesMap(user))
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
        {loadError ? (
          <p style={{ color: "#ff8a8a", textAlign: "center" }}>
            Ошибка: {loadError}. Выполни supabase/fix_all.sql в Supabase.
          </p>
        ) : null}
        {!loadError && posts.length === 0 ? (
          <p style={{ color: "#bbb", textAlign: "center" }}>
            В ленте пока нет постов. Напиши пост в профиле.
          </p>
        ) : null}
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
              <div style={redditCardStyles.cardActions}>
                <button
                  type="button"
                  onClick={() => {
                    if (!user?.id) {
                      alert("Войдите в аккаунт, чтобы ставить лайки")
                      return
                    }
                    toggleLike(p.id)
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: likedPostIds.includes(String(p.id)) ? "#ff5277" : "#c7c7c7",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  title={likedPostIds.includes(String(p.id)) ? "Убрать лайк" : "Поставить лайк"}
                >
                  <span style={{ fontSize: 21, marginRight: 4 }}>❤️</span>
                  {likedPostIds.includes(String(p.id)) ? "Уже нравится" : "Лайк"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!user?.id) {
                      alert("Войдите в аккаунт, чтобы добавлять в избранное")
                      return
                    }
                    toggleFavorite(p.id)
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: favoritePostIds.includes(String(p.id)) ? "#ffd36b" : "#c7c7c7",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  title={
                    favoritePostIds.includes(String(p.id))
                      ? "Убрать из избранного"
                      : "В избранное"
                  }
                >
                  <span style={{ fontSize: 21, marginRight: 4 }}>⭐</span>
                  {favoritePostIds.includes(String(p.id)) ? "В избранном" : "В избранное"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
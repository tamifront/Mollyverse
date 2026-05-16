import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { POST_SOURCE_FEED, POST_SOURCE_PROFILE, isVisibleInFeed } from "../utils/postSource"
import { getPostAuthorNickname, loadAllNicknamesMap } from "../utils/profiles"
import { usePostReactions } from "../hooks/usePostReactions"

function formatKZDateAlmaty(dt) {
  if (!dt) return ""
  try {
    let dateObj
    if (typeof dt === "string") {
      if (!dt.endsWith("Z") && !dt.includes("+")) {
        dateObj = new Date(dt + "Z")
      } else {
        dateObj = new Date(dt)
      }
    } else if (dt instanceof Date) {
      dateObj = dt
    } else {
      return ""
    }

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
      const parts = new Intl.DateTimeFormat("ru-RU", options).formatToParts(dateObj)
      const get = type => parts.find(p => p.type === type)?.value ?? ""
      return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`
    } catch (e) {
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

// -- Twitter/Reddit inspired styles --
const cardTheme = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #181c22 0%, #232946 100%)',
    padding: '36px 0',
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
  },
  pageTitle: {
    fontWeight: 800,
    fontSize: 32,
    margin: "0 0 32px 0",
    color: "#ffeefb",
    textAlign: "center",
    letterSpacing: "1px",
    textShadow: "0 2px 10px rgba(30,0,10,0.10)"
  },
  newPostForm: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "rgba(36,39,41,.92)",
    borderRadius: 18,
    maxWidth: 520,
    margin: "0 auto 32px auto",
    padding: "20px 20px 18px 20px",
    boxShadow: "0 2px 12px 0 rgba(0,0,0,0.13), 0 1.5px 9px 0 rgba(255,0,20,0.04)"
  },
  input: {
    borderRadius: 10,
    border: "1.2px solid rgba(70,70,80,0.22)",
    padding: "11px 13px",
    fontSize: 18,
    background: "#20222d",
    color: "#f5f5f7",
    outline: "none",
    marginBottom: 3,
    resize: 'vertical'
  },
  button: {
    background: "#2C2F3C",
    border: "1.5px solid #7979bb30",
    color: "#fff",
    borderRadius: 7,
    cursor: "pointer",
    padding: "8px 22px",
    fontWeight: 700,
    fontSize: 16,
    alignSelf: "flex-end",
    transition: "background .13s, border .11s"
  },
  postsContainer: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: "100%",
    maxWidth: 610,
    marginLeft: "auto",
    marginRight: "auto"
  },
  card: {
    background: "rgba(34,39,46,0.98)",
    borderRadius: 18,
    // borderTop: "3px solid #5366fd30",
    border: "1.5px solid #404878",
    boxShadow: "0 1.5px 11px 0 rgba(0,0,0,0.09), 0 1.5px 7px 0 rgba(255,0,20,0.02)",
    padding: "20px 20px 15px 18px",
    display: "flex",
    gap: 14,
    position: "relative",
    transition: "box-shadow .15s, border .17s",
    flexDirection: "row",
  },
  avatar: {
    flexShrink: 0,
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #495aff 55%, #ff4157 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: 22,
    marginTop: 2,
    userSelect: "none",
    boxShadow: "0 2px 12px rgba(20,44,245,0.09)"
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
    marginTop: 0
  },
  author: {
    color: "#84aaff",
    fontWeight: 700,
    fontSize: 17,
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180
  },
  date: {
    color: "#8196b2",
    fontSize: 13,
    fontWeight: 400,
  },
  content: {
    fontSize: 18,
    color: "#f1f0f3",
    marginBottom: 15,
    marginTop: 1,
    wordBreak: "break-word",
    whiteSpace: "pre-line",
    lineHeight: 1.55,
  },
  cardActions: {
    display: "flex",
    gap: 28,
    alignItems: "center",
    marginTop: 2,
    marginBottom: 0,
    fontSize: 17,
    opacity: 0.97,
    userSelect: "none"
  },
  iconAction: {
    background: "none",
    border: "none",
    color: "#bcbde3",
    fontSize: 19,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    padding: "0 2px",
    borderRadius: 5,
    transition: "background .11s, color .12s"
  },
  iconActionLiked: {
    color: "#e64367",
    backgroundColor: "rgba(255,54,78,0.06)"
  },
  iconActionFav: {
    color: "#ffd36b",
    backgroundColor: "rgba(250,230,82,0.05)"
  },
}

function getAvatarLetter(name) {
  if (!name) return "U"
  return String(name).trim()[0]?.toUpperCase() || "U"
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
    refreshReactions,
  } = usePostReactions(user)

  // Система лайков как в соцсетях: лайки минимум 0, начальное значение 0, при лайке +1
  async function handleToggleLike(postId) {
    if (!user?.id) {
      alert("Войдите в аккаунт, чтобы ставить лайки")
      return
    }

    const isLiked = likedPostIds.includes(String(postId))

    // --- Новый подход: лайк сохраняется в отдельной таблице post_likes, считаем их как aggregate

    // Сначала оптимистично обновляем UI (опционально)
    setPosts(posts =>
      posts.map(p => {
        if (p.id === postId) {
          let currentLikes = Number(p.likes ?? 0)
          if (isNaN(currentLikes) || currentLikes < 0) currentLikes = 0
          let newLikes
          if (isLiked) {
            newLikes = Math.max(currentLikes - 1, 0)
          } else {
            newLikes = currentLikes + 1
          }
          return { ...p, likes: newLikes }
        }
        return p
      })
    )

    // Теперь пишем/удаляем в таблице post_likes
    if (isLiked) {
      // Удаляем лайк
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .match({ post_id: postId, user_id: user.id })
      if (error) {
        alert("Ошибка при удалении лайка: " + error.message)
      }
    } else {
      // Ставим лайк
      const { error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id, created_at: new Date().toISOString() })
      if (error) {
        alert("Ошибка при добавлении лайка: " + error.message)
      }
    }

    // После любого действия загружаем фактическое количество лайков из базы и реакции пользователя
    await loadPosts()
    if (refreshReactions) {
      await refreshReactions()
    }
  }

  // Получаем посты + количество лайков из таблицы post_likes (aggregate)
  async function loadPosts() {
    // Получим все посты, а потом отдельно для них count лайков из post_likes для каждого поста
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

    // Узнаём id постов
    const postIds = (allPosts || [])
      .filter(isVisibleInFeed)
      .map(p => p.id)

    // Запрашиваем аггрегированные лайки для всех постов
    let likesByPostId = {}
    if (postIds.length > 0) {
      // получаем список лайков для всех постов
      const { data: likeCounts, error: likesError } = await supabase
        .from("post_likes")
        .select("post_id, count:id")
        .in("post_id", postIds)
        .group("post_id") // агрегируем по post_id

      if (!likesError && Array.isArray(likeCounts)) {
        for (const like of likeCounts) {
          likesByPostId[like.post_id] = Number(like.count ?? 0)
        }
      }
    }

    // Склеиваем посты с их лайками
    const sanitizedPosts = (allPosts || []).filter(isVisibleInFeed).map(p => ({
      ...p,
      likes: Math.max(Number(likesByPostId[p.id] ?? 0), 0),
    }))
    setPosts(sanitizedPosts)
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
      // лайки по умолчанию 0 в бд, но они считаются по post_likes теперь
      likes: 0,
      created_at: new Date().toISOString(),
    }
    let { error } = await supabase.from("posts").insert(payload)
    if (error) {
      const { error: fallbackError } = await supabase.from("posts").insert({
        content: text.trim(),
        user_id: user.id,
        likes: 0,
        created_at: new Date().toISOString(),
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
    <div style={cardTheme.container}>
      <h1 style={cardTheme.pageTitle}>📰 Посты</h1>
      <form
        style={cardTheme.newPostForm}
        onSubmit={e => {
          e.preventDefault()
          createPost()
        }}
      >
        <textarea
          style={cardTheme.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что у тебя нового?"
          rows={3}
        />
        <button
          type="submit"
          style={{
            ...cardTheme.button,
            opacity: !text.trim() ? 0.5 : 1,
            pointerEvents: !text.trim() ? "none" : "auto"
          }}
          disabled={!text.trim()}
        >
          <span style={{ fontWeight: 800, marginRight: 6 }}>➤</span> Опубликовать
        </button>
      </form>

      <div style={cardTheme.postsContainer}>
        {loadError ? (
          <p style={{ color: "#ff8a8a", textAlign: "center", fontSize: 17 }}>
            Ошибка: {loadError}. Выполни supabase/fix_all.sql в Supabase.
          </p>
        ) : null}
        {!loadError && posts.length === 0 ? (
          <p style={{ color: "#bbb", textAlign: "center", fontSize: 16 }}>
            В ленте пока нет постов. Напиши пост в профиле.
          </p>
        ) : null}
        {posts.map((p) => {
          const authorNick = getPostAuthorNickname(p, profilesById, user)
          return (
            <div key={p.id} style={cardTheme.card}>
              <div style={cardTheme.avatar}>
                {getAvatarLetter(authorNick)}
              </div>
              <div style={cardTheme.main}>
                <div style={cardTheme.cardHeader}>
                  <span style={cardTheme.author}>{authorNick}</span>
                  {/* Добавим форматированную дату публикации поста */}
                  <span style={cardTheme.date} title={p.created_at}>
                    {formatKZDateAlmaty(p.created_at)}
                  </span>
                </div>
                <div style={cardTheme.content}>
                  {p.content}
                </div>
                <div style={cardTheme.cardActions}>
                  <button
                    type="button"
                    onClick={() => handleToggleLike(p.id)}
                    style={{
                      ...cardTheme.iconAction,
                      ...(likedPostIds.includes(String(p.id)) ? cardTheme.iconActionLiked : null)
                    }}
                    title={likedPostIds.includes(String(p.id)) ? "Убрать лайк" : "Поставить лайк"}
                  >
                    <span style={{ fontSize: 21, marginRight: 3 }}>
                      {likedPostIds.includes(String(p.id)) ? "❤️" : "🤍"}
                    </span>
                    <span style={{
                      fontWeight: 700, fontSize: 15,
                    }}>{Math.max(Number(p.likes ?? 0), 0)}</span>
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
                      ...cardTheme.iconAction,
                      ...(favoritePostIds.includes(String(p.id)) ? cardTheme.iconActionFav : null)
                    }}
                    title={
                      favoritePostIds.includes(String(p.id))
                        ? "Убрать из избранного"
                        : "В избранное"
                    }
                  >
                    <span style={{ fontSize: 21 }}>{favoritePostIds.includes(String(p.id)) ? "⭐" : "☆"}</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
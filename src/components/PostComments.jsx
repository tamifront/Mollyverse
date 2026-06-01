import { useCallback, useEffect, useState } from "react"
import { formatKZDateAlmaty } from "../utils/datetime"
import { getPostAuthorNickname } from "../utils/profiles"
import {
  addPostComment,
  deletePostComment,
  isCommentsTableMissing,
  loadCommentsForPost,
} from "../utils/postComments"
import { fetchNicknamesByUserIds } from "../utils/profiles"
import "./PostComments.css"

function getAvatarLetter(name) {
  if (!name) return "U"
  return String(name).trim()[0]?.toUpperCase() || "U"
}

/**
 * Сворачиваемая секция комментариев под постом (как в Telegram).
 */
export default function PostComments({
  postId,
  user,
  profilesById = {},
  initialCount = 0,
  onCountChange,
}) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(Math.max(Number(initialCount) || 0, 0))
  const [comments, setComments] = useState([])
  const [nicknames, setNicknames] = useState({})
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    setCount(Math.max(Number(initialCount) || 0, 0))
  }, [initialCount, postId])

  const updateCount = useCallback(
    (next) => {
      setCount((prev) => {
        const n =
          typeof next === "function"
            ? Math.max(Number(next(prev)) || 0, 0)
            : Math.max(Number(next) || 0, 0)
        onCountChange?.(n)
        return n
      })
    },
    [onCountChange]
  )

  const enrichNicknames = useCallback(
    async (rows) => {
      const ids = [...new Set((rows || []).map((c) => c.user_id).filter(Boolean))]
      const missing = ids.filter((id) => !profilesById[id])
      if (!missing.length) return

      const fetched = await fetchNicknamesByUserIds(missing)
      if (Object.keys(fetched).length) {
        setNicknames((prev) => ({ ...prev, ...fetched }))
      }
    },
    [profilesById]
  )

  const loadComments = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setLoadError("")
    try {
      const rows = await loadCommentsForPost(postId)
      setComments(rows)
      setLoaded(true)
      updateCount(rows.length)
      await enrichNicknames(rows)
    } catch (err) {
      if (isCommentsTableMissing(err)) {
        setLoadError("Таблица комментариев не создана. Выполни supabase/post_comments.sql")
      } else {
        setLoadError(err?.message || "Не удалось загрузить комментарии")
      }
    } finally {
      setLoading(false)
    }
  }, [enrichNicknames, postId, updateCount])

  useEffect(() => {
    if (open && !loaded && !loading) {
      loadComments()
    }
  }, [open, loaded, loading, loadComments])

  const getNickname = (uid) => {
    if (uid && profilesById[uid]) return profilesById[uid]
    if (uid && nicknames[uid]) return nicknames[uid]
    if (uid && user?.id === uid) {
      return getPostAuthorNickname({ user_id: uid }, profilesById, user)
    }
    return "без ника"
  }

  const handleToggle = () => {
    setOpen((v) => !v)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!user?.id) {
      alert("Войдите в аккаунт, чтобы комментировать")
      return
    }
    const trimmed = text.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    const { data, error } = await addPostComment(postId, user.id, trimmed)
    setSubmitting(false)

    if (error) {
      if (isCommentsTableMissing(error)) {
        alert("Таблица комментариев не создана. Выполни supabase/post_comments.sql в Supabase.")
      } else {
        alert(error.message || "Не удалось отправить комментарий")
      }
      return
    }

    setText("")
    if (data) {
      setComments((prev) => [...prev, data])
      updateCount((c) => c + 1)
      setNicknames((prev) => ({
        ...prev,
        [user.id]: getNickname(user.id),
      }))
      if (!open) setOpen(true)
    }
  }

  const handleDelete = async (commentId) => {
    if (!user?.id) return
    const { error } = await deletePostComment(commentId, user.id)
    if (error) {
      alert(error.message || "Не удалось удалить комментарий")
      return
    }
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== commentId)
      updateCount(next.length)
      return next
    })
  }

  return (
    <div className={`post-comments${open ? " post-comments--open" : ""}`}>
      <button
        type="button"
        className="post-comments-toggle"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <span className="post-comments-toggle-label">Комментарии</span>
        {count > 0 ? (
          <span className="post-comments-toggle-count">{count}</span>
        ) : null}
        <span className={`post-comments-chevron${open ? " is-open" : ""}`} aria-hidden="true">
          ›
        </span>
      </button>

      {open ? (
        <div className="post-comments-panel">
          {loading ? (
            <p className="post-comments-hint">Загрузка...</p>
          ) : loadError ? (
            <p className="post-comments-error">{loadError}</p>
          ) : comments.length === 0 ? (
            <p className="post-comments-hint">Пока нет комментариев. Напиши первым!</p>
          ) : (
            <ul className="post-comments-list">
              {comments.map((c) => {
                const nick = getNickname(c.user_id)
                const isOwn = user?.id === c.user_id
                return (
                  <li key={c.id} className="post-comment">
                    <span className="post-comment-avatar">{getAvatarLetter(nick)}</span>
                    <div className="post-comment-body">
                      <div className="post-comment-meta">
                        <span className="post-comment-author">{nick}</span>
                        <time className="post-comment-date" dateTime={c.created_at}>
                          {formatKZDateAlmaty(c.created_at)}
                        </time>
                      </div>
                      <p className="post-comment-text">{c.content}</p>
                      {isOwn ? (
                        <button
                          type="button"
                          className="post-comment-delete"
                          onClick={() => handleDelete(c.id)}
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <form className="post-comments-form" onSubmit={handleSubmit}>
            <textarea
              className="post-comments-input mv-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={user?.id ? "Написать комментарий..." : "Войдите, чтобы комментировать"}
              rows={2}
              disabled={!user?.id || submitting}
            />
            <button
              type="submit"
              className="mv-btn mv-btn--primary post-comments-send"
              disabled={!user?.id || !text.trim() || submitting}
            >
              {submitting ? "..." : "Отправить"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}

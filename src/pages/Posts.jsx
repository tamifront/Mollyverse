import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { POST_SOURCE_FEED, isVisibleInFeed } from "../utils/postSource"
import {
  getPostAuthorAvatar,
  getPostAuthorNickname,
  loadAllProfilesMap,
} from "../utils/profiles"
import UserAvatar from "../components/UserAvatar"
import { usePostReactions } from "../hooks/usePostReactions"
import { formatKZDateAlmaty } from "../utils/datetime"
import { getLikeCountsForPosts, getFavoriteCountsForPosts } from "../utils/postLikes"
import { getCommentCountsForPosts } from "../utils/postComments"
import { uploadPostImage, validatePostImage } from "../utils/postImages"
import LikeButton from "../components/LikeButton"
import FavoriteButton from "../components/FavoriteButton"
import PostComments from "../components/PostComments"
import "../styles/Posts.css"

export default function Posts({ user }) {
  const [posts, setPosts] = useState([])
  const [text, setText] = useState("")
  const [profilesById, setProfilesById] = useState({})
  const [loadError, setLoadError] = useState("")
  const [pendingLikes, setPendingLikes] = useState(() => new Set())
  const [commentCounts, setCommentCounts] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState("")
  const [creatingPost, setCreatingPost] = useState(false)

  const {
    likedPostIds,
    favoritePostIds,
    toggleLike,
    toggleFavorite,
  } = usePostReactions(user)

  const syncLikeCount = useCallback(async (postId) => {
    const counts = await getLikeCountsForPosts([postId])
    const postIdStr = String(postId)
    setPosts((prev) =>
      prev.map((p) =>
        String(p.id) === postIdStr
          ? { ...p, likes: Math.max(Number(counts[postId] ?? 0), 0) }
          : p
      )
    )
  }, [])

  const syncFavoriteCount = useCallback(async (postId) => {
    const counts = await getFavoriteCountsForPosts([postId])
    const postIdStr = String(postId)
    setPosts((prev) =>
      prev.map((p) =>
        String(p.id) === postIdStr
          ? { ...p, favorites: Math.max(Number(counts[postId] ?? 0), 0) }
          : p
      )
    )
  }, [])

  async function loadPosts() {
    const { data: allPosts, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) {
      setLoadError(error.message || "Не удалось загрузить посты")
      setPosts([])
      setProfilesById({})
      return
    }
    setLoadError("")

    const filtered = (allPosts || []).filter(isVisibleInFeed)
    const postIds = filtered.map((p) => p.id)
    const [likesByPostId, favsByPostId, commentsByPostId] = await Promise.all([
      getLikeCountsForPosts(postIds),
      getFavoriteCountsForPosts(postIds),
      getCommentCountsForPosts(postIds),
    ])

    const sanitizedPosts = filtered.map((p) => ({
      ...p,
      likes: Math.max(Number(likesByPostId[p.id] ?? 0), 0),
      favorites: Math.max(Number(favsByPostId[p.id] ?? 0), 0),
    }))
    setPosts(sanitizedPosts)
    setCommentCounts(commentsByPostId)
    setProfilesById(await loadAllProfilesMap(user))
  }

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleToggleLike(postId) {
    if (!user?.id) {
      alert("Войдите в аккаунт, чтобы ставить лайки")
      return
    }

    const postIdStr = String(postId)
    if (pendingLikes.has(postIdStr)) return

    setPendingLikes((prev) => new Set(prev).add(postIdStr))
    try {
      const ok = await toggleLike(postId)
      if (ok) await syncLikeCount(postId)
    } finally {
      setPendingLikes((prev) => {
        const next = new Set(prev)
        next.delete(postIdStr)
        return next
      })
    }
  }

  async function handleToggleFavorite(postId) {
    if (!user?.id) {
      alert("Войдите в аккаунт, чтобы добавлять в избранное")
      return
    }
    await toggleFavorite(postId)
    await syncFavoriteCount(postId)
  }

  async function createPost(e) {
    e?.preventDefault()
    if (!user?.id) {
      alert("Войдите в аккаунт")
      return
    }
    if (!text.trim() && !imageFile) {
      alert("Добавьте текст или фото.")
      return
    }
    setCreatingPost(true)
    let uploadedUrl = ""
    if (imageFile) {
      const { url, error: imageError } = await uploadPostImage(user.id, imageFile)
      if (imageError) {
        setCreatingPost(false)
        alert(imageError.message || "Не удалось загрузить фото")
        return
      }
      uploadedUrl = url
    }
    const payload = {
      content: text.trim(),
      post_image_url: uploadedUrl,
      user_id: user.id,
      post_source: POST_SOURCE_FEED,
      likes: 0,
      created_at: new Date().toISOString(),
    }
    let { error } = await supabase.from("posts").insert(payload)
    if (error) {
      const { error: fallbackError } = await supabase.from("posts").insert({
        content: text.trim(),
        post_image_url: uploadedUrl,
        user_id: user.id,
        likes: 0,
        created_at: new Date().toISOString(),
      })
      error = fallbackError
    }

    if (error) {
      setCreatingPost(false)
      alert(error.message)
      return
    }

    setText("")
    setImageFile(null)
    setImagePreview("")
    setCreatingPost(false)
    await loadPosts()
  }

  return (
    <div className="posts-page">
      <header className="posts-header">
        <h1>Лента</h1>
        <p>Новости и посты сообщества</p>
      </header>

      <form className="mv-panel mv-panel--compose posts-compose" onSubmit={createPost}>
        <textarea
          className="mv-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что у тебя нового?"
          rows={3}
        />
        {imagePreview ? (
          <div className="post-compose-image-wrap">
            <img src={imagePreview} alt="" className="post-compose-image" />
          </div>
        ) : null}
        <div className="post-compose-media">
          <label className="mv-btn mv-btn--ghost post-compose-media-label">
            Добавить фото
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="post-compose-file-input"
              disabled={creatingPost}
              onChange={(e) => {
                const file = e.target.files?.[0]
                const err = validatePostImage(file)
                if (err) {
                  alert(err)
                  e.target.value = ""
                  return
                }
                setImageFile(file || null)
                setImagePreview(file ? URL.createObjectURL(file) : "")
              }}
            />
          </label>
          {imagePreview ? (
            <button
              type="button"
              className="mv-btn mv-btn--ghost"
              disabled={creatingPost}
              onClick={() => {
                setImageFile(null)
                setImagePreview("")
              }}
            >
              Убрать фото
            </button>
          ) : null}
        </div>
        <div className="posts-compose-actions">
          <button
            type="submit"
            className="mv-btn mv-btn--primary"
            disabled={creatingPost || (!text.trim() && !imageFile)}
          >
            {creatingPost ? "Публикуем..." : "Опубликовать"}
          </button>
        </div>
      </form>

      <div className="posts-feed">
        {loadError ? (
          <p className="posts-error">
            Ошибка: {loadError}. Выполни supabase/fix_all.sql в Supabase.
          </p>
        ) : null}

        {!loadError && posts.length === 0 ? (
          <p className="posts-empty">
            В ленте пока нет постов. Напиши пост в профиле.
          </p>
        ) : null}

        {posts.map((p) => {
          const authorNick = getPostAuthorNickname(p, profilesById, user)
          const authorAvatar = getPostAuthorAvatar(p, profilesById, user)
          const postIdStr = String(p.id)
          const liked = likedPostIds.includes(postIdStr)
          const faved = favoritePostIds.includes(postIdStr)
          const likePending = pendingLikes.has(postIdStr)
          const likeCount = Math.max(Number(p.likes ?? 0), 0)
          const favCount = Math.max(Number(p.favorites ?? 0), 0)

          return (
            <article key={p.id} className="post-card">
              <UserAvatar
                className="post-avatar"
                nickname={authorNick}
                avatarUrl={authorAvatar}
                size="md"
              />
              <div className="post-body">
                <div className="post-meta">
                  <span className="post-author">{authorNick}</span>
                  <time className="post-date" dateTime={p.created_at}>
                    {formatKZDateAlmaty(p.created_at)}
                  </time>
                </div>
                <p className="post-text">{p.content}</p>
                {p.post_image_url ? (
                  <div className="post-image-wrap">
                    <img src={p.post_image_url} alt="" className="post-image" loading="lazy" />
                  </div>
                ) : null}
                <div className="post-actions">
                  <LikeButton
                    variant="feed"
                    className={`post-action-btn post-action-btn--like${liked ? " is-liked" : ""}`}
                    liked={liked}
                    count={likeCount}
                    disabled={likePending}
                    onClick={() => handleToggleLike(p.id)}
                  />
                  <FavoriteButton
                    variant="feed"
                    className={`post-action-btn post-action-btn--fav${faved ? " is-faved" : ""}`}
                    favorited={faved}
                    count={favCount}
                    onClick={() => handleToggleFavorite(p.id)}
                  />
                </div>
                <PostComments
                  postId={p.id}
                  user={user}
                  profilesById={profilesById}
                  initialCount={commentCounts[p.id] ?? 0}
                  onCountChange={(n) =>
                    setCommentCounts((prev) => ({ ...prev, [p.id]: n }))
                  }
                />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
// Заменяем import на форматтер для Казахстана
import {
  getPostAuthorAvatar,
  getPostAuthorNickname,
  loadAllProfilesMap,
} from "../utils/profiles"
import UserAvatar from "../components/UserAvatar"
import { formatKZDate } from "../utils/datetime"
import { usePostReactions } from "../hooks/usePostReactions"
import { getLikeCountsForPosts, getFavoriteCountsForPosts } from "../utils/postLikes"
import { getCommentCountsForPosts } from "../utils/postComments"
import LikeButton from "../components/LikeButton"
import FavoriteButton from "../components/FavoriteButton"
import PostComments from "../components/PostComments"
import "../styles/SearchPosts.css"

export default function SearchPosts({ user }) {
  const [posts, setPosts] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [followingIds, setFollowingIds] = useState([])
  const [friendIds, setFriendIds] = useState([])
  const [actionLoadingId, setActionLoadingId] = useState("")
  const [pendingLikes, setPendingLikes] = useState(() => new Set())
  const [commentCounts, setCommentCounts] = useState({})

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

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("*")
          .order("created_at", { ascending: false })

        if (postsError) {
          console.error(postsError)
          setPosts([])
        } else {
          const postIds = (postsData || []).map((p) => p.id)
          const [likesByPostId, favsByPostId, commentsByPostId] = await Promise.all([
            getLikeCountsForPosts(postIds),
            getFavoriteCountsForPosts(postIds),
            getCommentCountsForPosts(postIds),
          ])
          setPosts(
            (postsData || []).map((p) => ({
              ...p,
              likes: Math.max(Number(likesByPostId[p.id] ?? 0), 0),
              favorites: Math.max(Number(favsByPostId[p.id] ?? 0), 0),
            }))
          )
          setCommentCounts(commentsByPostId)
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id,nickname,bio,avatar_url")

        if (profilesError) {
          console.error("Профили:", profilesError)
        }

        setUsers(profilesData || [])
        setProfilesById(await loadAllProfilesMap(user))
      } catch (e) {
        console.error(e)
        setPosts([])
        setUsers([])
        setProfilesById({})
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user?.id])

  useEffect(() => {
    async function loadMySocial() {
      if (!user?.id) return

      const [{ data: following, error: followError }, { data: friends, error: friendsError }] =
        await Promise.all([
          supabase.from("follows").select("following_id").eq("follower_id", user.id),
          supabase.from("friends").select("friend_id").eq("user_id", user.id),
        ])

      if (followError && followError.code !== "42P01") {
        alert(followError.message || "Ошибка загрузки подписок")
      }
      if (friendsError && friendsError.code !== "42P01") {
        alert(friendsError.message || "Ошибка загрузки друзей")
      }

      setFollowingIds((following || []).map((i) => i.following_id))
      setFriendIds((friends || []).map((i) => i.friend_id))
    }

    loadMySocial()
  }, [user?.id])

  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return posts

    return posts.filter((post) => {
      const content = (post.content || "").toLowerCase()
      const nickname = getPostAuthorNickname(post, profilesById, user).toLowerCase()
      return content.includes(normalized) || nickname.includes(normalized)
    })
  }, [posts, profilesById, query, user])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    return users.filter((profile) => {
      const nickname = (profile.nickname || "").toLowerCase()
      return nickname.includes(normalized)
    })
  }, [query, users])

  const handleToggleFollow = async (targetUserId) => {
    if (!user?.id || !targetUserId) return
    setActionLoadingId(`follow-${targetUserId}`)

    const alreadyFollowing = followingIds.includes(targetUserId)
    if (alreadyFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
      if (error) {
        alert(error.message || "Не удалось отменить подписку")
      } else {
        setFollowingIds((prev) => prev.filter((id) => id !== targetUserId))
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetUserId,
      })
      if (error) {
        alert(error.message || "Не удалось подписаться")
      } else {
        setFollowingIds((prev) => [...prev, targetUserId])
      }
    }

    setActionLoadingId("")
  }

  const handleToggleFriend = async (targetUserId) => {
    if (!user?.id || !targetUserId) return
    setActionLoadingId(`friend-${targetUserId}`)

    const alreadyFriend = friendIds.includes(targetUserId)
    if (alreadyFriend) {
      const { error } = await supabase
        .from("friends")
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
      if (error) {
        alert(error.message || "Не удалось удалить из друзей")
      } else {
        setFriendIds((prev) => prev.filter((id) => id !== targetUserId))
      }
    } else {
      const { data, error: authError } = await supabase.auth.getUser()
    
      const authUser = data?.user
    
      if (authError || !authUser) {
        alert("Нет авторизации")
        return
      }
    
      const { error } = await supabase.from("friends").insert([
        {
          user_id: authUser.id,
          friend_id: targetUserId,
        },
      ])
    
      if (error) {
        console.log("INSERT ERROR:", error)
        alert(error.message || "Не удалось добавить в друзья")
      } else {
        setFriendIds((prev) => [...prev, targetUserId])
      }
    }
    

    setActionLoadingId("")
  }

  const handleToggleLike = async (postId) => {
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

  const handleToggleFavorite = async (postId) => {
    if (!user?.id) {
      alert("Войдите в аккаунт, чтобы добавлять в избранное")
      return
    }
    await toggleFavorite(postId)
    await syncFavoriteCount(postId)
  }


  return (
    <div className="search-page">
      <header className="search-header">
        <h1>Поиск</h1>
      </header>

      <div className="mv-panel search-panel">
        <input
          className="mv-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Слово в посте или ник пользователя..."
        />
        <p className="search-hint">Поиск по тексту поста и нику автора.</p>
      </div>

      {!loading && query.trim() && filteredUsers.length > 0 && (
        <div className="mv-panel search-users">
          <h2>Пользователи</h2>
          {filteredUsers.map((profile) => (
            <div key={profile.id} className="search-user-row">
              <UserAvatar
                nickname={profile.nickname || "без ника"}
                avatarUrl={profile.avatar_url}
                size="md"
              />
              <div>
                <div className="search-user-name">{profile.nickname || "без ника"}</div>
                {profile.bio ? <div className="search-user-bio">{profile.bio}</div> : null}
              </div>
              {profile.id === user?.id ? (
                <span className="search-hint">Это вы</span>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`mv-btn${followingIds.includes(profile.id) ? "" : " mv-btn--primary"}`}
                    onClick={() => handleToggleFollow(profile.id)}
                    disabled={actionLoadingId === `follow-${profile.id}`}
                  >
                    {followingIds.includes(profile.id) ? "Отписаться" : "Подписаться"}
                  </button>
                  <button
                    type="button"
                    className="mv-btn"
                    onClick={() => handleToggleFriend(profile.id)}
                    disabled={actionLoadingId === `friend-${profile.id}`}
                  >
                    {friendIds.includes(profile.id) ? "Убрать из друзей" : "В друзья"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="search-results">
        {loading && <p className="mv-empty">Загрузка...</p>}
        {!loading && query.trim() && filteredUsers.length === 0 && filteredPosts.length === 0 && (
          <p className="mv-empty">Ничего не найдено.</p>
        )}

        {!loading &&
          filteredPosts.map((post) => {
            const postIdStr = String(post.id)
            const liked = likedPostIds.includes(postIdStr)
            const faved = favoritePostIds.includes(postIdStr)
            const likePending = pendingLikes.has(postIdStr)
            const authorNick = getPostAuthorNickname(post, profilesById, user)
            const authorAvatar = getPostAuthorAvatar(post, profilesById, user)

            return (
            <article key={post.id} className="mv-panel search-result-card">
              <div className="search-result-head">
                <UserAvatar nickname={authorNick} avatarUrl={authorAvatar} size="md" />
              <div className="search-result-meta">
                <span className="search-result-author">{authorNick}</span>
                <time className="search-result-date">{formatKZDate(post.created_at)}</time>
              </div>
              </div>
              <p className="search-result-text">{post.content}</p>
              <div className="post-actions search-result-actions">
                <LikeButton
                  variant="feed"
                  className={`post-action-btn post-action-btn--like${liked ? " is-liked" : ""}`}
                  liked={liked}
                  count={Math.max(Number(post.likes ?? 0), 0)}
                  disabled={likePending}
                  onClick={() => handleToggleLike(post.id)}
                />
                <FavoriteButton
                  variant="feed"
                  className={`post-action-btn post-action-btn--fav${faved ? " is-faved" : ""}`}
                  favorited={faved}
                  count={Math.max(Number(post.favorites ?? 0), 0)}
                  onClick={() => handleToggleFavorite(post.id)}
                />
              </div>
              <PostComments
                postId={post.id}
                user={user}
                profilesById={profilesById}
                initialCount={commentCounts[post.id] ?? 0}
                onCountChange={(n) =>
                  setCommentCounts((prev) => ({ ...prev, [post.id]: n }))
                }
              />
            </article>
            )
          })}
      </div>
    </div>
  )
}

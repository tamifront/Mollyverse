import { useEffect, useState, useCallback, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { POST_SOURCE_PROFILE } from "../utils/postSource"
import {
  getProfileFromMap,
  loadAllProfilesMap,
  normalizeProfileEntry,
} from "../utils/profiles"
import { uploadProfileAvatar, removeProfileAvatar } from "../utils/avatars"
import { uploadPostImage, validatePostImage } from "../utils/postImages"
import UserAvatar from "../components/UserAvatar"
import { usePostReactions } from "../hooks/usePostReactions"
import { formatKZDateAlmaty } from "../utils/datetime"
import { loadLikesMapForPosts, getFavoriteCountsForPosts } from "../utils/postLikes"
import { getCommentCountsForPosts } from "../utils/postComments"
import LikeButton from "../components/LikeButton"
import FavoriteButton from "../components/FavoriteButton"
import PostComments from "../components/PostComments"
import {
  checkIsFollowing,
  getFollowRequestStatus,
  requestFollow,
  cancelFollowRequest,
  unfollow,
  followPublic,
  canViewProfileContent,
  loadPostsByUserReaction,
} from "../utils/follows"
import "../styles/Profile.css"

const PROFILE_TABS = [
  { key: "posts", label: "Посты" },
  { key: "liked", label: "Лайкнутые" },
  { key: "favorites", label: "Избранное" },
]

// New helper to show a popup with users who liked the post
function LikedUsersPopup({ open, onClose, users }) {
  if (!open) return null
  return (
    <div className="mv-modal-overlay" onClick={onClose}>
      <div className="mv-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Понравилось пользователям</h3>
        {users.length === 0 ? (
          <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Пока никто не лайкнул</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="mv-modal-user">
              <UserAvatar
                className="mv-modal-user-avatar"
                nickname={u.nickname}
                avatarUrl={u.avatar_url}
                size="sm"
              />
              <span>{u.nickname || "Без ника"}</span>
            </div>
          ))
        )}
        <button type="button" className="mv-btn mv-btn--ghost" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

// ── PostCard теперь со всплывающим списком пользователей, поставивших лайк ──
function PostCard({
  post,
  authorNick,
  authorAvatar,
  user,
  liked,
  favorited,
  favoriteCount,
  onLike,
  onFavorite,
  onDelete,
  canDelete,
  likeUsers,
  profilesById,
  commentCount,
  onCommentCountChange,
}) {
  const [popupOpen, setPopupOpen] = useState(false)

  const handleLikesCountClick = (e) => {
    e.stopPropagation()
    setPopupOpen(true)
  }

  return (
    <article className="post-card">
      <UserAvatar
        className="post-avatar"
        nickname={authorNick}
        avatarUrl={authorAvatar}
        size="md"
      />
      <div className="post-body">
        <div className="post-meta">
          <span className="post-author">{authorNick}</span>
          <time className="post-date" dateTime={post.created_at}>
            {formatKZDateAlmaty(post.created_at)}
          </time>
          {post.edited && <span className="post-edited">(изменён)</span>}
        </div>
        <p className="post-text">{post.content}</p>
        {post.post_image_url ? (
          <div className="post-image-wrap">
            <img src={post.post_image_url} alt="" className="post-image" loading="lazy" />
          </div>
        ) : null}
        <div className="post-actions">
          <LikeButton
            variant="profile"
            liked={liked}
            onClick={() => onLike(post.id)}
            count={Math.max(Number(likeUsers?.length ?? post.likes ?? 0), 0)}
            onCountClick={likeUsers?.length ? handleLikesCountClick : undefined}
            className={`post-action-btn post-action-btn--like${liked ? " is-liked" : ""}`}
          />
          <LikedUsersPopup open={popupOpen} onClose={() => setPopupOpen(false)} users={likeUsers || []} />
          <FavoriteButton
            variant="profile"
            className={`post-action-btn post-action-btn--fav${favorited ? " is-faved" : ""}`}
            favorited={favorited}
            count={Math.max(Number(favoriteCount ?? 0), 0)}
            onClick={() => onFavorite(post.id)}
          />
          {canDelete && (
            <button
              type="button"
              className="post-action-btn post-action-btn--delete"
              onClick={() => onDelete(post.id)}
              title="Удалить пост"
            >
              Удалить
            </button>
          )}
        </div>
        <PostComments
          postId={post.id}
          user={user}
          profilesById={profilesById}
          initialCount={commentCount ?? 0}
          onCountChange={onCommentCountChange}
        />
      </div>
    </article>
  )
}

// ── главный компонент ────────────────────────────────────────────────────────
export default function Profile({ user, profileUserId, onViewProfile, onBack }) {
  const effectiveProfileUserId = profileUserId || user?.id
  const isOwnProfile = !profileUserId || profileUserId === user?.id

  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [postAuthors, setPostAuthors] = useState({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const [nickname, setNickname] = useState("")
  const [bio, setBio] = useState("")
  const [profileLoading, setProfileLoading] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [friends, setFriends] = useState([])
  const [activeSocialList, setActiveSocialList] = useState("")
  const [activeTab, setActiveTab] = useState("posts")
  const [likesMap, setLikesMap] = useState({})
  const [favoriteCountsMap, setFavoriteCountsMap] = useState({})
  const [commentCountsMap, setCommentCountsMap] = useState({})
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState("")
  const [creatingPost, setCreatingPost] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followRequestStatus, setFollowRequestStatus] = useState(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [profileUserLikedPosts, setProfileUserLikedPosts] = useState([])
  const [profileUserFavoritePosts, setProfileUserFavoritePosts] = useState([])

  const {
    likedPostIds,
    favoritePostIds,
    likedPosts,
    favoritePosts,
    toggleLike: handleLike,
    toggleFavorite: handleFavorite,
    refresh: refreshReactions,
  } = usePostReactions(user)

  const isPrivate = Boolean(profile?.is_private)
  const canViewContent = canViewProfileContent({
    isOwnProfile,
    isPrivate,
    isFollowing,
  })

  const tabPosts = posts
  const tabLikedPosts = isOwnProfile ? likedPosts : profileUserLikedPosts
  const tabFavoritePosts = isOwnProfile ? favoritePosts : profileUserFavoritePosts

  const displayedPosts =
    activeTab === "posts"
      ? tabPosts
      : activeTab === "liked"
        ? tabLikedPosts
        : tabFavoritePosts

  const loadFollowState = useCallback(async () => {
    if (!user?.id || !effectiveProfileUserId || isOwnProfile) {
      setIsFollowing(false)
      setFollowRequestStatus(null)
      return
    }
    const [followingNow, requestStatus] = await Promise.all([
      checkIsFollowing(user.id, effectiveProfileUserId),
      getFollowRequestStatus(user.id, effectiveProfileUserId),
    ])
    setIsFollowing(followingNow)
    setFollowRequestStatus(requestStatus)
  }, [user?.id, effectiveProfileUserId, isOwnProfile])

  const loadProfileReactions = useCallback(async () => {
    if (!effectiveProfileUserId || isOwnProfile) {
      setProfileUserLikedPosts([])
      setProfileUserFavoritePosts([])
      return
    }
    const [liked, favorites] = await Promise.all([
      loadPostsByUserReaction(effectiveProfileUserId, "post_likes"),
      loadPostsByUserReaction(effectiveProfileUserId, "post_favorites"),
    ])
    setProfileUserLikedPosts(liked)
    setProfileUserFavoritePosts(favorites)
  }, [effectiveProfileUserId, isOwnProfile])

  // ── функция для загрузки пользователей, лайкнувших каждый пост ─────────────
  const loadLikes = useCallback(async (postList) => {
    if (!postList?.length) {
      setLikesMap({})
      setFavoriteCountsMap({})
      setCommentCountsMap({})
      return
    }
    const postIds = postList.map((p) => p.id)
    const [likes, favCounts, commentCounts] = await Promise.all([
      loadLikesMapForPosts(postList),
      getFavoriteCountsForPosts(postIds),
      getCommentCountsForPosts(postIds),
    ])
    setLikesMap(likes)
    setFavoriteCountsMap(favCounts)
    setCommentCountsMap(commentCounts)
  }, [])

  const profilesById = useMemo(() => {
    const map = {}
    for (const [id, p] of Object.entries(postAuthors)) {
      map[id] = normalizeProfileEntry(p)
    }
    return map
  }, [postAuthors])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setAvatarUploading(true)
    const { url, error } = await uploadProfileAvatar(user.id, file)
    setAvatarUploading(false)
    if (error) {
      alert(error.message || "Не удалось загрузить аватар")
      return
    }
    setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
    setPostAuthors((prev) => ({
      ...prev,
      [user.id]: {
        ...(prev[user.id] || { id: user.id }),
        nickname: prev[user.id]?.nickname || nickname || "без ника",
        avatar_url: url,
      },
    }))
    e.target.value = ""
  }

  const handleAvatarRemove = async () => {
    if (!user?.id) return
    setAvatarUploading(true)
    const { error } = await removeProfileAvatar(user.id)
    setAvatarUploading(false)
    if (error) {
      alert(error.message || "Не удалось удалить аватар")
      return
    }
    setProfile((prev) => (prev ? { ...prev, avatar_url: "" } : prev))
    setPostAuthors((prev) => ({
      ...prev,
      [user.id]: {
        ...(prev[user.id] || { id: user.id }),
        nickname: prev[user.id]?.nickname || nickname || "без ника",
        avatar_url: "",
      },
    }))
  }

  // ── загрузка профиля ───────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!effectiveProfileUserId) return
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", effectiveProfileUserId)
      .maybeSingle()

    if (error) { console.error("Ошибка загрузки профиля:", error); return }

    if (!data) {
      if (profileUserId) { setProfile(null); setNickname(""); setBio(""); return }
      const initialProfile = { id: user.id, nickname: user.user_metadata?.nickname || "без ника", bio: "" }
      const { data: created, error: createError } = await supabase
        .from("profiles").upsert(initialProfile, { onConflict: "id" }).select().single()
      if (createError) { console.error("Ошибка создания профиля:", createError); return }
      setProfile(created); setNickname(created.nickname || ""); setBio(created.bio || "")
      return
    }
    setProfile(data); setNickname(data.nickname || ""); setBio(data.bio || "")
  }, [effectiveProfileUserId, user, profileUserId])

  // ── загрузка постов ────────────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    if (!effectiveProfileUserId) { setPosts([]); setPostAuthors({}); setLikesMap({}); return }
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", effectiveProfileUserId)
      .order("created_at", { ascending: false })
    if (error) { setPosts([]); setLikesMap({}); return }
    setPosts(data || [])
    const profilesMap = await loadAllProfilesMap(user)
    const authorsMap = {}
    for (const [id, prof] of Object.entries(profilesMap)) {
      authorsMap[id] = { id, nickname: prof.nickname, avatar_url: prof.avatar_url }
    }
    setPostAuthors(authorsMap)
    // After posts loaded, load like info
    await loadLikes(data || [])
  }, [effectiveProfileUserId, user, loadLikes])

  const mapUsersById = useCallback(async (ids = []) => {
    if (!ids.length) return []
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nickname,avatar_url")
      .in("id", ids)
    if (error) return []
    const byId = {}
    ;(data || []).forEach((row) => {
      const prof = normalizeProfileEntry(row)
      byId[row.id] = prof
    })
    return ids.map((id) => ({
      id,
      nickname: byId[id]?.nickname || "без ника",
      avatar_url: byId[id]?.avatar_url || "",
    }))
  }, [])

  const loadSocial = useCallback(async () => {
    if (!effectiveProfileUserId) return
    const [{ data: followersData }, { data: followingData }, { data: friendsData }] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("following_id", effectiveProfileUserId),
      supabase.from("follows").select("following_id").eq("follower_id", effectiveProfileUserId),
      supabase.from("friends").select("friend_id").eq("user_id", effectiveProfileUserId),
    ])
    const [followersUsers, followingUsers, friendsUsers] = await Promise.all([
      mapUsersById((followersData || []).map((i) => i.follower_id)),
      mapUsersById((followingData || []).map((i) => i.following_id)),
      mapUsersById((friendsData || []).map((i) => i.friend_id)),
    ])
    setFollowers(followersUsers); setFollowing(followingUsers); setFriends(friendsUsers)
  }, [mapUsersById, effectiveProfileUserId])

  useEffect(() => {
    if (!effectiveProfileUserId) {
      setProfile(null)
      setPosts([])
      setPostAuthors({})
      setLikesMap({})
      return
    }
    setActiveTab("posts")
    loadProfile()
    loadPosts()
    loadSocial()
    loadFollowState()
  }, [loadPosts, loadProfile, loadSocial, loadFollowState, effectiveProfileUserId])

  useEffect(() => {
    if (!canViewContent) return
    loadProfileReactions()
  }, [canViewContent, loadProfileReactions])

  useEffect(() => {
    const merged = [
      ...posts,
      ...likedPosts,
      ...favoritePosts,
      ...profileUserLikedPosts,
      ...profileUserFavoritePosts,
    ]
    const byId = new Map()
    merged.forEach((p) => { if (p?.id) byId.set(p.id, p) })
    loadLikes([...byId.values()])
  }, [posts, likedPosts, favoritePosts, profileUserLikedPosts, profileUserFavoritePosts, loadLikes])

  // ── создание поста ─────────────────────────────────────────────────────────
  const createPost = async () => {
    if (!text.trim() && !imageFile) return alert("Добавьте текст или фото")
    if (profileUserId && profileUserId !== user.id) return alert("Нельзя создавать пост не на своём аккаунте!")
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
      user_id: user.id,
      content: text.trim(),
      post_image_url: uploadedUrl,
      likes: 0,
      post_source: POST_SOURCE_PROFILE,
    }
    let { error } = await supabase.from("posts").insert(payload)
    if (error) {
      const { error: fallbackError } = await supabase.from("posts").insert({
        user_id: user.id,
        content: text.trim(),
        post_image_url: uploadedUrl,
        likes: 0,
      })
      error = fallbackError
    }
    if (error) {
      setCreatingPost(false)
      alert(error.message || "Не удалось создать пост")
      return
    }
    setText("")
    setImageFile(null)
    setImagePreview("")
    setOpen(false)
    setCreatingPost(false)
    loadPosts()
  }

  // ── удаление поста ─────────────────────────────────────────────────────────
  const handleDeletePost = async (postId) => {
    const post = posts.find((p) => p.id === postId)
    if (!post || post.user_id !== user.id || (profileUserId && profileUserId !== user.id)) return
    const { error } = await supabase.from("posts").delete().eq("id", postId)
    if (error) { alert(error.message || "Не удалось удалить пост"); return }
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    loadPosts(); refreshReactions()
  }

  // Когда пользователь ставит/убирает лайк, чтобы снова получить актуальные users лайкнувших
  const handleLikeWithReload = async (postId) => {
    await handleLike(postId)
    const merged = [...posts, ...likedPosts, ...favoritePosts]
    const byId = new Map()
    merged.forEach((p) => { if (p?.id) byId.set(p.id, p) })
    await loadLikes([...byId.values()])
  }

  const handleFavoriteWithReload = async (postId) => {
    await handleFavorite(postId)
    const merged = [...posts, ...likedPosts, ...favoritePosts]
    const byId = new Map()
    merged.forEach((p) => { if (p?.id) byId.set(p.id, p) })
    await loadLikes([...byId.values()])
  }

  const handleFollowAction = async () => {
    if (!user?.id || isOwnProfile || followLoading) return
    setFollowLoading(true)

    try {
      if (isFollowing) {
        const { error } = await unfollow(user.id, effectiveProfileUserId)
        if (error) alert(error.message || "Не удалось отписаться")
        else setIsFollowing(false)
      } else if (followRequestStatus === "pending") {
        const { error } = await cancelFollowRequest(user.id, effectiveProfileUserId)
        if (error) alert(error.message || "Не удалось отменить запрос")
        else setFollowRequestStatus(null)
      } else if (isPrivate) {
        const { error } = await requestFollow(user.id, effectiveProfileUserId)
        if (error) alert(error.message || "Не удалось отправить запрос")
        else setFollowRequestStatus("pending")
      } else {
        const { error } = await followPublic(user.id, effectiveProfileUserId)
        if (error) alert(error.message || "Не удалось подписаться")
        else setIsFollowing(true)
      }
    } finally {
      setFollowLoading(false)
    }
  }

  const followButtonLabel = isFollowing
    ? "Отписаться"
    : followRequestStatus === "pending"
      ? "Запрос отправлен"
      : isPrivate
        ? "Запросить подписку"
        : "Подписаться"

  function renderSocialUser(item) {
    const isClickable = item.id !== user?.id && onViewProfile
    return (
      <div
        key={item.id}
        className={`profile-social-user${isClickable ? " profile-social-user--link" : ""}`}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={() => isClickable && onViewProfile(item.id)}
        onKeyDown={(e) => {
          if (isClickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            onViewProfile(item.id)
          }
        }}
      >
        <UserAvatar nickname={item.nickname} avatarUrl={item.avatar_url} size="sm" />
        <span>{item.nickname}</span>
      </div>
    )
  }

  const emptyTabMessage =
    activeTab === "posts"
      ? "Постов пока нет."
      : activeTab === "liked"
        ? "Нет лайкнутых постов."
        : "Нет избранных постов."
  return (
    <div className="profile-page">

      {onBack && (
        <button type="button" className="profile-back-btn mv-btn mv-btn--ghost" onClick={onBack}>
          ← Назад
        </button>
      )}

      <header className="profile-header">
        <UserAvatar
          className="profile-header-avatar"
          nickname={profile?.nickname || "без ника"}
          avatarUrl={profile?.avatar_url}
          size="xl"
        />
        <h1>{profile?.nickname || "без ника"}</h1>
        {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
        {isPrivate && !isOwnProfile && (
          <p className="profile-private-badge">🔒 Приватный аккаунт</p>
        )}
      </header>

      {!isOwnProfile && (
        <div className="profile-actions-center">
          <button
            type="button"
            className={`mv-btn${isFollowing ? "" : " mv-btn--primary"}`}
            onClick={handleFollowAction}
            disabled={followLoading}
          >
            {followLoading ? "..." : followButtonLabel}
          </button>
        </div>
      )}

      {isOwnProfile && !editing && (
        <div className="profile-actions-center">
          <button
            type="button"
            className="mv-btn mv-btn--ghost"
            onClick={() => { setNickname(profile?.nickname || ""); setBio(profile?.bio || ""); setSaveMsg(""); setEditing(true) }}
          >
            Редактировать профиль
          </button>
        </div>
      )}

      {editing && (
        <form
          className="mv-panel"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!user?.id || (profileUserId && profileUserId !== user.id)) return
            setProfileLoading(true); setSaveMsg("")
            const payload = {
              id: user.id,
              nickname: nickname.trim() || "без ника",
              bio: bio.trim(),
              avatar_url: profile?.avatar_url || "",
            }
            const { data, error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" }).select().single()
            setProfileLoading(false)
            if (error) { setSaveMsg(error?.message || "Ошибка сохранения 😢"); return }
            setProfile(data); setNickname(data.nickname || ""); setBio(data.bio || ""); setSaveMsg("Сохранено!"); setEditing(false)
          }}
        >
          <div className="profile-avatar-edit">
            <UserAvatar
              nickname={nickname || profile?.nickname || "без ника"}
              avatarUrl={profile?.avatar_url}
              size="lg"
            />
            <div className="profile-avatar-edit-actions">
              <label className="mv-btn mv-btn--ghost profile-avatar-upload-label">
                {avatarUploading ? "Загрузка..." : "Сменить фото"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="profile-avatar-file-input"
                  disabled={avatarUploading || profileLoading}
                  onChange={handleAvatarUpload}
                />
              </label>
              {profile?.avatar_url ? (
                <button
                  type="button"
                  className="mv-btn mv-btn--ghost"
                  disabled={avatarUploading || profileLoading}
                  onClick={handleAvatarRemove}
                >
                  Убрать фото
                </button>
              ) : null}
            </div>
          </div>
          <label className="mv-label">Ник</label>
          <input
            className="mv-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={profileLoading}
            minLength={2} maxLength={32} placeholder="Ваш ник" required
          />
          <label className="mv-label">Bio</label>
          <textarea
            className="mv-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={profileLoading}
            maxLength={256} placeholder="Расскажите о себе"
            rows={3}
          />
          <div className="mv-form-actions">
            <button
              type="button"
              disabled={profileLoading}
              className="mv-btn mv-btn--ghost"
              onClick={() => { setEditing(false); setNickname(profile?.nickname || ""); setBio(profile?.bio || ""); setSaveMsg("") }}
            >
              Отмена
            </button>
            <button type="submit" disabled={profileLoading} className="mv-btn mv-btn--primary">
              {profileLoading ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
          {saveMsg && (
            <p className={saveMsg === "Сохранено!" ? "mv-msg--ok" : "mv-msg--err"}>{saveMsg}</p>
          )}
        </form>
      )}

      <div className="profile-social-bar">
        {[
          { key: "followers", label: `Подписчики (${followers.length})` },
          { key: "friends", label: `Друзья (${friends.length})` },
          { key: "following", label: `Подписки (${following.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`mv-btn${activeSocialList === key ? " mv-btn--active" : ""}`}
            onClick={() => setActiveSocialList((prev) => (prev === key ? "" : key))}
          >
            {label}
          </button>
        ))}
      </div>

      {canViewContent && activeSocialList === "followers" && (
        <div className="mv-panel profile-social-list">
          <h3>Подписчики</h3>
          {followers.length === 0
            ? <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Подписчиков пока нет.</p>
            : followers.map(renderSocialUser)}
        </div>
      )}
      {canViewContent && activeSocialList === "friends" && (
        <div className="mv-panel profile-social-list">
          <h3>Друзья</h3>
          {friends.length === 0
            ? <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Друзей пока нет.</p>
            : friends.map(renderSocialUser)}
        </div>
      )}
      {canViewContent && activeSocialList === "following" && (
        <div className="mv-panel profile-social-list">
          <h3>Подписки</h3>
          {following.length === 0
            ? <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Подписок пока нет.</p>
            : following.map(renderSocialUser)}
        </div>
      )}

      {isOwnProfile && (
        <div className="mv-panel profile-compose-toggle">
          <button type="button" className="mv-btn" onClick={() => setOpen(!open)}>
            {open ? "Свернуть" : "Написать пост"}
          </button>
          {open && (
            <div className="profile-compose-inner">
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
              <button
                type="button"
                className="mv-btn mv-btn--primary"
                onClick={createPost}
                disabled={creatingPost || (!text.trim() && !imageFile)}
              >
                {creatingPost ? "Публикуем..." : "Опубликовать"}
              </button>
            </div>
          )}
        </div>
      )}

      {!canViewContent && !isOwnProfile ? (
        <div className="mv-panel profile-private-wall">
          <p className="profile-private-message">ой, кажется этот аккаунт приватный:(</p>
          <p className="mv-hint" style={{ padding: 0, textAlign: "center" }}>
            Подпишитесь и дождитесь одобрения, чтобы смотреть посты.
          </p>
        </div>
      ) : (
        <>
          <div className="profile-tabs">
            {PROFILE_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`profile-tab${activeTab === key ? " profile-tab--active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="posts-feed">
            {displayedPosts.length === 0 && (
              <p className="mv-empty">{emptyTabMessage}</p>
            )}
            {displayedPosts.map((p) => {
              const authorProf = getProfileFromMap(profilesById, p.user_id)
              const authorNick =
                postAuthors[p.user_id]?.nickname ||
                authorProf.nickname ||
                (p.user_id === user?.id ? "Вы" : "без ника")
              const canDel = p.user_id === user?.id && isOwnProfile && activeTab === "posts"
              return (
                <PostCard
                  key={p.id}
                  post={p}
                  authorNick={authorNick}
                  authorAvatar={authorProf.avatar_url}
                  user={user}
                  liked={likedPostIds.includes(String(p.id))}
                  favorited={favoritePostIds.includes(String(p.id))}
                  onLike={handleLikeWithReload}
                  onFavorite={handleFavoriteWithReload}
                  onDelete={handleDeletePost}
                  canDelete={canDel}
                  likeUsers={likesMap[p.id] || []}
                  favoriteCount={favoriteCountsMap[p.id] ?? 0}
                  profilesById={profilesById}
                  commentCount={commentCountsMap[p.id] ?? 0}
                  onCommentCountChange={(n) =>
                    setCommentCountsMap((prev) => ({ ...prev, [p.id]: n }))
                  }
                />
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}
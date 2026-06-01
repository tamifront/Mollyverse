import { useEffect, useState, useCallback, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { POST_SOURCE_PROFILE } from "../utils/postSource"
import {
  getProfileFromMap,
  loadAllProfilesMap,
  normalizeProfileEntry,
} from "../utils/profiles"
import { uploadProfileAvatar, removeProfileAvatar } from "../utils/avatars"
import UserAvatar from "../components/UserAvatar"
import { usePostReactions } from "../hooks/usePostReactions"
import { formatKZDateAlmaty } from "../utils/datetime"
import { loadLikesMapForPosts, getFavoriteCountsForPosts } from "../utils/postLikes"
import { getCommentCountsForPosts } from "../utils/postComments"
import LikeButton from "../components/LikeButton"
import FavoriteButton from "../components/FavoriteButton"
import PostComments from "../components/PostComments"
import "../styles/Profile.css"

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
export default function Profile({ user, profileUserId }) {
  const effectiveProfileUserId = profileUserId || user?.id

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
  const [likesMap, setLikesMap] = useState({})
  const [favoriteCountsMap, setFavoriteCountsMap] = useState({})
  const [commentCountsMap, setCommentCountsMap] = useState({})
  const [avatarUploading, setAvatarUploading] = useState(false)

  const {
    likedPostIds,
    favoritePostIds,
    likedPosts,
    favoritePosts,
    toggleLike: handleLike,
    toggleFavorite: handleFavorite,
    refresh: refreshReactions,
  } = usePostReactions(user)

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
    if (!effectiveProfileUserId) { setProfile(null); setPosts([]); setPostAuthors({}); setLikesMap({}); return }
    loadProfile(); loadPosts(); loadSocial()
  }, [loadPosts, loadProfile, loadSocial, effectiveProfileUserId])

  useEffect(() => {
    const merged = [...posts, ...likedPosts, ...favoritePosts]
    const byId = new Map()
    merged.forEach((p) => { if (p?.id) byId.set(p.id, p) })
    loadLikes([...byId.values()])
  }, [posts, likedPosts, favoritePosts, loadLikes])

  // ── создание поста ─────────────────────────────────────────────────────────
  const createPost = async () => {
    if (!text.trim()) return alert("Пост не может быть пустым")
    if (profileUserId && profileUserId !== user.id) return alert("Нельзя создавать пост не на своём аккаунте!")
    const payload = { user_id: user.id, content: text.trim(), likes: 0, post_source: POST_SOURCE_PROFILE }
    let { error } = await supabase.from("posts").insert(payload)
    if (error) {
      const { error: fallbackError } = await supabase.from("posts").insert({ user_id: user.id, content: text.trim(), likes: 0 })
      error = fallbackError
    }
    if (error) { alert(error.message || "Не удалось создать пост"); return }
    setText(""); setOpen(false); loadPosts()
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

  const isOwnProfile = !profileUserId || profileUserId === user?.id

  // ── рендер ────────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">

      <header className="profile-header">
        <UserAvatar
          className="profile-header-avatar"
          nickname={profile?.nickname || "без ника"}
          avatarUrl={profile?.avatar_url}
          size="xl"
        />
        <h1>{profile?.nickname || "без ника"}</h1>
        {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
      </header>

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

      {activeSocialList === "followers" && (
        <div className="mv-panel profile-social-list">
          <h3>Подписчики</h3>
          {followers.length === 0
            ? <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Подписчиков пока нет.</p>
            : followers.map((item) => (
              <div key={item.id} className="profile-social-user">
                <UserAvatar nickname={item.nickname} avatarUrl={item.avatar_url} size="sm" />
                <span>{item.nickname}</span>
              </div>
            ))}
        </div>
      )}
      {activeSocialList === "friends" && (
        <div className="mv-panel profile-social-list">
          <h3>Друзья</h3>
          {friends.length === 0
            ? <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Друзей пока нет.</p>
            : friends.map((item) => (
              <div key={item.id} className="profile-social-user">
                <UserAvatar nickname={item.nickname} avatarUrl={item.avatar_url} size="sm" />
                <span>{item.nickname}</span>
              </div>
            ))}
        </div>
      )}
      {activeSocialList === "following" && (
        <div className="mv-panel profile-social-list">
          <h3>Подписки</h3>
          {following.length === 0
            ? <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>Подписок пока нет.</p>
            : following.map((item) => (
              <div key={item.id} className="profile-social-user">
                <UserAvatar nickname={item.nickname} avatarUrl={item.avatar_url} size="sm" />
                <span>{item.nickname}</span>
              </div>
            ))}
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
              <button
                type="button"
                className="mv-btn mv-btn--primary"
                onClick={createPost}
                disabled={!text.trim()}
              >
                Опубликовать
              </button>
            </div>
          )}
        </div>
      )}

      <div className="posts-feed">
        {posts.length === 0 && (
          <p className="mv-empty">Постов пока нет.</p>
        )}
        {posts.map((p) => {
          const authorProf = getProfileFromMap(profilesById, p.user_id)
          const authorNick =
            postAuthors[p.user_id]?.nickname ||
            authorProf.nickname ||
            (p.user_id === user?.id ? "Вы" : "без ника")
          const canDel = p.user_id === user?.id && isOwnProfile
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

      {/* Лайкнутые посты — только свой профиль */}
      {isOwnProfile && (
        <>
          <h2 className="mv-section-title profile-section--liked">Лайкнутые посты</h2>
          <div className="posts-feed">
            {likedPosts.length === 0 && (
              <p className="mv-empty">Нет лайкнутых постов.</p>
            )}
            {likedPosts.map((p) => {
              const authorProf = getProfileFromMap(profilesById, p.user_id)
              const authorNick = authorProf.nickname
              return (
                <PostCard
                  key={p.id}
                  post={p}
                  authorNick={authorNick}
                  authorAvatar={authorProf.avatar_url}
                user={user}
                  liked={true}
                  favorited={favoritePostIds.includes(String(p.id))}
                  onLike={handleLikeWithReload}
                  onFavorite={handleFavoriteWithReload}
                  onDelete={() => {}}
                  canDelete={false}
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

      {/* Избранное — только свой профиль */}
      {isOwnProfile && (
        <>
          <h2 className="mv-section-title profile-section--fav">Избранное</h2>
          <div className="posts-feed">
            {favoritePosts.length === 0 && (
              <p className="mv-empty">Нет избранных постов.</p>
            )}
            {favoritePosts.map((p) => {
              const authorProf = getProfileFromMap(profilesById, p.user_id)
              const authorNick = authorProf.nickname
          return (
                <PostCard
                  key={p.id}
                  post={p}
                  authorNick={authorNick}
                  authorAvatar={authorProf.avatar_url}
                  user={user}
                  liked={likedPostIds.includes(String(p.id))}
                  favorited={true}
                  onLike={handleLikeWithReload}
                  onFavorite={handleFavoriteWithReload}
                  onDelete={() => {}}
                  canDelete={false}
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
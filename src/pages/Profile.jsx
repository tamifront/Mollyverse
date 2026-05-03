import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { formatKZDate } from "../utils/datetime"

// ===== localStorage helpers =====
function saveToLs(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {}
}

function loadFromLs(key, defaultVal = []) {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : defaultVal
  } catch {
    return defaultVal
  }
}

function getStorageKey(user, type) {
  return user?.id ? `profile_${user.id}_${type}` : null
}

// =================== КОММЕНТАРИЙ ======================
// Причина бага: твой код раньше показывал для всех постов в профиле всегда один и тот же никнейм:
//   {profile?.nickname || "Вы"}
// profile - это ТОЛЬКО профиль текущего залогиненого пользователя. 
// Но список постов posts включает ВСЕ посты, сделанные разными пользователями (user_id).
// Поэтому если ты заходишь под своим другом — его profile подтягивает, а посты твои,
// и выходит везде стоит чужой profile.nickname!
// Надо для каждого поста получать nickname того, кто его написал (по user_id ― автор поста)
// ======================================================

// =======================
// Добавим поддержку просмотра чужих профилей:
// Если передан проп profileUserId - показывать профиль и посты profileUserId,
// если нет - показывать профиль и посты текущего залогиненного пользователя
// =======================

export default function Profile({ user, profileUserId }) {
  // Если profileUserId есть (например, это страница друга), показываем его профиль и только ЕГО посты.
  // Если profileUserId нет, используем пользователя из user (авторизованного).
  const effectiveProfileUserId = profileUserId || user?.id;

  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [postAuthors, setPostAuthors] = useState({}) // user_id => { id, nickname }
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

  // Только для лайкнутых/избранных/создания мы храним для user. 
  const [likedPostIds, setLikedPostIds] = useState(() =>
    user ? loadFromLs(getStorageKey(user, "likedPostIds")) : []
  )
  const [likedPosts, setLikedPosts] = useState(() =>
    user ? loadFromLs(getStorageKey(user, "likedPosts")) : []
  )
  const [favoritePostIds, setFavoritePostIds] = useState(() =>
    user ? loadFromLs(getStorageKey(user, "favoritePostIds")) : []
  )
  const [favoritePosts, setFavoritePosts] = useState(() =>
    user ? loadFromLs(getStorageKey(user, "favoritePosts")) : []
  )

  const updateLs = useCallback((type, val) => {
    if (!user) return
    const key = getStorageKey(user, type)
    if (key) saveToLs(key, val)
  }, [user])

  // ===== PROFILE =====
  const loadProfile = useCallback(async () => {
    if (!effectiveProfileUserId) return

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", effectiveProfileUserId)
      .maybeSingle()

    if (error) {
      console.error("Ошибка загрузки профиля:", error)
      return
    }

    if (!data) {
      // Если profileUserId - чужой - не создаем профиль, просто ничего не покажем
      if (profileUserId) {
        setProfile(null)
        setNickname("")
        setBio("")
        return
      }

      // Только если это личный профиль - создать профиль в supabase, если не существует
      const initialProfile = { 
        id: user.id,
        nickname: user.user_metadata?.nickname || "без ника",
        bio: ""
      }

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(initialProfile, { onConflict: "id" })
        .select()
        .single()

      if (createError) {
        console.error("Ошибка создания профиля:", createError)
        return
      }

      setProfile(created)
      setNickname(created.nickname || "")
      setBio(created.bio || "")
      return
    }

    setProfile(data)
    setNickname(data.nickname || "")
    setBio(data.bio || "")
  }, [effectiveProfileUserId, user, profileUserId])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!user?.id || (profileUserId && profileUserId !== user.id)) return

    setProfileLoading(true)
    setSaveMsg("")

    const payload = {
      id: user.id,
      nickname: nickname.trim() || "без ника",
      bio: bio.trim()
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single()

    setProfileLoading(false)

    if (error) {
        console.error("SAVE ERROR:", error)
        setSaveMsg(error?.message || "Ошибка сохранения 😢")
      return
    }

    setProfile(data)
    setNickname(data.nickname || "")
    setBio(data.bio || "")
    setSaveMsg("Сохранено!")
    setEditing(false)
  }

  // ===== POSTS =====
  const loadPosts = useCallback(async () => {
    if (!effectiveProfileUserId) {
      setPosts([])
      setPostAuthors({})
      return
    }
    // На странице профиля показываем только посты соответствующего пользователя.
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", effectiveProfileUserId)
      .order("created_at", { ascending: false })

    if (error) return;

    setPosts(data || [])

    // Собираем уникальные user_id из постов
    const userIds = Array.from(new Set((data || []).map(p => p.user_id).filter(Boolean)))
    if (userIds.length === 0) {
      setPostAuthors({})
      return
    }

    // Загружаем никнеймы авторов
    const { data: usersData, error: usersError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", userIds)

    if (usersError) {
      console.error("Ошибка загрузки авторов постов:", usersError)
      setPostAuthors({})
      return
    }

    const authorsMap = {}
    for (const user of usersData || []) {
      authorsMap[user.id] = user
    }
    setPostAuthors(authorsMap)
  }, [effectiveProfileUserId])

  const mapUsersById = useCallback(async (ids = []) => {
    if (!ids.length) return []
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nickname")
      .in("id", ids)

    if (error) {
      console.error("Ошибка загрузки профилей:", error)
      return []
    }

    const byId = {}
    ;(data || []).forEach((row) => {
      byId[row.id] = row.nickname || "без ника"
    })

    return ids.map((id) => ({ id, nickname: byId[id] || "без ника" }))
  }, [])

  const loadSocial = useCallback(async () => {
    if (!effectiveProfileUserId) return

    const [{ data: followersData, error: followersError }, { data: followingData, error: followingError }, { data: friendsData, error: friendsError }] =
      await Promise.all([
        supabase.from("follows").select("follower_id").eq("following_id", effectiveProfileUserId),
        supabase.from("follows").select("following_id").eq("follower_id", effectiveProfileUserId),
        supabase.from("friends").select("friend_id").eq("user_id", effectiveProfileUserId),
      ])

    if (followersError && followersError.code !== "42P01") {
      console.error("Ошибка загрузки подписчиков:", followersError)
    }
    if (followingError && followingError.code !== "42P01") {
      console.error("Ошибка загрузки подписок:", followingError)
    }
    if (friendsError && friendsError.code !== "42P01") {
      console.error("Ошибка загрузки друзей:", friendsError)
    }

    const followerIds = (followersData || []).map((item) => item.follower_id)
    const followingIds = (followingData || []).map((item) => item.following_id)
    const friendIds = (friendsData || []).map((item) => item.friend_id)

    const [followersUsers, followingUsers, friendsUsers] = await Promise.all([
      mapUsersById(followerIds),
      mapUsersById(followingIds),
      mapUsersById(friendIds),
    ])

    setFollowers(followersUsers)
    setFollowing(followingUsers)
    setFriends(friendsUsers)
  }, [mapUsersById, effectiveProfileUserId])

  // ===== INIT =====
  useEffect(() => {
    if (!effectiveProfileUserId) {
      setLikedPostIds([])
      setLikedPosts([])
      setFavoritePostIds([])
      setFavoritePosts([])
      setProfile(null)
      setPosts([])
      setPostAuthors({})
      return
    }

    loadProfile()
    loadPosts()
    loadSocial()
  }, [loadPosts, loadProfile, loadSocial, effectiveProfileUserId])

  useEffect(() => {
    if (!user?.id) return
    setLikedPostIds(loadFromLs(getStorageKey(user, "likedPostIds")))
    setLikedPosts(loadFromLs(getStorageKey(user, "likedPosts")))
    setFavoritePostIds(loadFromLs(getStorageKey(user, "favoritePostIds")))
    setFavoritePosts(loadFromLs(getStorageKey(user, "favoritePosts")))
  }, [user?.id])

  useEffect(() => {
    const liked = likedPostIds
      .map((id) => posts.find((p) => p.id === id))
      .filter(Boolean)
    const favorites = favoritePostIds
      .map((id) => posts.find((p) => p.id === id))
      .filter(Boolean)

    setLikedPosts(liked)
    updateLs("likedPosts", liked)
    setFavoritePosts(favorites)
    updateLs("favoritePosts", favorites)
  }, [favoritePostIds, likedPostIds, posts, updateLs])

  // ===== CREATE POST =====
  const createPost = async () => {
    // Запрещаем создавать пост, если ты не на своей странице
    if (!text.trim()) return alert("Пост не может быть пустым")
    if (profileUserId && profileUserId !== user.id) return alert("Нельзя создавать пост не на своем аккаунте!")

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: text.trim(),
      likes: 0
    })
    if (error) {
      alert(error.message || "Не удалось создать пост")
      return
    }

    setText("")
    setOpen(false)
    loadPosts()
  }

  // ===== LIKE POST =====
  const handleLike = async (postId) => {
    if (!user?.id) return

    const alreadyLiked = likedPostIds.includes(postId)
    const nextIds = alreadyLiked
      ? likedPostIds.filter((id) => id !== postId)
      : [...likedPostIds, postId]
    setLikedPostIds(nextIds)
    updateLs("likedPostIds", nextIds)
  }

  // ===== FAVORITE POST =====
  const handleFavorite = async (postId) => {
    if (!user?.id) return

    const alreadyFavorite = favoritePostIds.includes(postId)
    const nextIds = alreadyFavorite
      ? favoritePostIds.filter((id) => id !== postId)
      : [...favoritePostIds, postId]
    setFavoritePostIds(nextIds)
    updateLs("favoritePostIds", nextIds)
  }

  // ===== DELETE =====
  const handleDeletePost = async (postId) => {
    const post = posts.find(p => p.id === postId)
    // Только свои посты можно удалять!
    if (!post || post.user_id !== user.id || (profileUserId && profileUserId !== user.id)) return

    const { error } = await supabase.from("posts").delete().eq("id", postId)
    if (error) {
      alert(error.message || "Не удалось удалить пост")
      return
    }

    setPosts(prev => prev.filter(p => p.id !== postId))
    const nextLikedIds = likedPostIds.filter((id) => id !== postId)
    const nextFavoriteIds = favoritePostIds.filter((id) => id !== postId)
    setLikedPostIds(nextLikedIds)
    setFavoritePostIds(nextFavoriteIds)
    updateLs("likedPostIds", nextLikedIds)
    updateLs("favoritePostIds", nextFavoriteIds)
    loadPosts()
  }

  // ==== CARD STYLE ====
  const cardStyle = {
    border: "1px solid #282828",
    borderRadius: 12,
    boxShadow: "0 2px 14px 0 rgba(0,0,0,0.15)",
    background: "#191b20",
    margin: "18px auto",
    padding: "18px 20px 8px 20px",
    maxWidth: 540,
    color: "#e9e9f9",
    position: "relative"
  }

  const cardHeaderStyle = {
    fontWeight: 600,
    color: "#aac6f6",
    fontSize: 16,
    marginBottom: 8
  }

  const cardActionsStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    alignItems: "center",
    marginTop: 6,
    fontSize: 17
  }

  // ===== RENDER =====
  return (
    <div className="profile" style={{minHeight: '100vh', background:"#141516"}}>

      {/* HEADER */}
      <h1 style={{color:"#fff", marginBottom:16, fontSize:32, letterSpacing: 1, marginTop: 24}}>
        👤 {profile?.nickname || "без ника"}
      </h1>

      {/* Кнопка редактирования профиля и создания поста - только если смотришь свой профиль */}
      {(!profileUserId || profileUserId === user?.id) && (
        <button
          onClick={() => {
            setNickname(profile?.nickname || "")
            setBio(profile?.bio || "")
            setSaveMsg("")
            setEditing(true)
          }}
          style={{marginBottom:20, background:"#222", color: "white", border:"none", borderRadius: 7, padding:"8px 18px", cursor: "pointer", fontWeight:600}}
        >
          ✏️ Редактировать профиль
        </button>
      )}

      <div style={{ maxWidth: 540, margin: "0 auto 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveSocialList((prev) => (prev === "followers" ? "" : "followers"))}
          style={{ background: "#24282f", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}
        >
          Мои подписчики ({followers.length})
        </button>
        <button
          onClick={() => setActiveSocialList((prev) => (prev === "friends" ? "" : "friends"))}
          style={{ background: "#24282f", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}
        >
          Мои друзья ({friends.length})
        </button>
        <button
          onClick={() => setActiveSocialList((prev) => (prev === "following" ? "" : "following"))}
          style={{ background: "#24282f", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}
        >
          Мои подписки ({following.length})
        </button>
      </div>

      {activeSocialList === "followers" && (
        <div style={{ maxWidth: 540, margin: "0 auto 16px", background: "#1e2234", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Подписчики</h3>
          {followers.length === 0 ? <p style={{ marginBottom: 0 }}>Подписчиков пока нет.</p> : followers.map((item) => <p key={item.id} style={{ margin: "6px 0" }}>• {item.nickname}</p>)}
        </div>
      )}

      {activeSocialList === "friends" && (
        <div style={{ maxWidth: 540, margin: "0 auto 16px", background: "#1e2234", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Друзья (видно всем)</h3>
          {friends.length === 0 ? <p style={{ marginBottom: 0 }}>Друзей пока нет.</p> : friends.map((item) => <p key={item.id} style={{ margin: "6px 0" }}>• {item.nickname}</p>)}
        </div>
      )}

      {activeSocialList === "following" && (
        <div style={{ maxWidth: 540, margin: "0 auto 16px", background: "#1e2234", borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Подписки (видно только вам)</h3>
          {following.length === 0 ? <p style={{ marginBottom: 0 }}>Подписок пока нет.</p> : following.map((item) => <p key={item.id} style={{ margin: "6px 0" }}>• {item.nickname}</p>)}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSaveProfile}
          style={{
            maxWidth: 540,
            margin: "0 auto 18px",
            background: "#1e2234",
            borderRadius: 10,
            padding: 16
          }}
        >
          <label style={{ display: "block", marginBottom: 6, color: "#f7d489", fontWeight: 700 }}>
            Ник
          </label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={profileLoading}
            minLength={2}
            maxLength={32}
            placeholder="Ваш ник"
            required
            style={{
              width: "100%",
              fontSize: 16,
              borderRadius: 6,
              border: "1px solid #333",
              background: "#191b20",
              color: "#fff",
              marginBottom: 12,
              padding: 8
            }}
          />

          <label style={{ display: "block", marginBottom: 6, color: "#f7d489", fontWeight: 700 }}>
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={profileLoading}
            maxLength={256}
            placeholder="Расскажите о себе"
            style={{
              width: "100%",
              minHeight: 70,
              resize: "vertical",
              borderRadius: 6,
              border: "1px solid #333",
              background: "#191b20",
              color: "#fff",
              marginBottom: 12,
              padding: 8,
              fontSize: 16
            }}
          />

          <button
            type="submit"
            disabled={profileLoading}
            style={{
              background: "#32b26a",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 15px",
              fontWeight: 600,
              cursor: profileLoading ? "not-allowed" : "pointer",
              marginRight: 8
            }}
          >
            {profileLoading ? "Сохраняем..." : "💾 Сохранить"}
          </button>
          <button
            type="button"
            disabled={profileLoading}
            onClick={() => {
              setEditing(false)
              setNickname(profile?.nickname || "")
              setBio(profile?.bio || "")
              setSaveMsg("")
            }}
            style={{
              background: "#222",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 6,
              padding: "6px 15px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Отмена
          </button>

          {saveMsg && (
            <div
              style={{
                marginTop: 10,
                color: saveMsg === "Сохранено!" ? "#55e491" : "#f96868",
                fontWeight: 500
              }}
            >
              {saveMsg}
            </div>
          )}
        </form>
      )}

      {/* CREATE POST - только если смотришь свой профиль */}
      {(!profileUserId || profileUserId === user?.id) && (
        <div style={{maxWidth:540, margin:"0 auto 18px", background:"#1e2234", borderRadius:10, padding:16}}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              color:"#fff",
              background: open ? "#bce0ff" : "#24282f",
              border: "none",
              borderRadius: 6,
              padding: "7px 18px",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: 8
            }}
          >
            ✍️ Написать пост
          </button>

          {open && (
            <div style={{marginTop:10}}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 70,
                  resize: "vertical",
                  borderRadius: 7,
                  border: "1px solid #333",
                  background: "#191b20",
                  color: "#fff",
                  marginBottom: 8,
                  padding: 8,
                  fontSize: 16
                }}
                placeholder="Что у вас нового?"
              />
              <button
                onClick={createPost}
                style={{
                  background: "#60b0ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 15px",
                  fontWeight:600,
                  cursor:"pointer"
                }}
              >
                💾 Сохранить
              </button>
            </div>
          )}
        </div>
      )}

      {/* POSTS */}
      <div>
        {posts.map(p => {
          // Показываем ник автора для каждого поста отдельно!
          const author = postAuthors[p.user_id]
          // author?.nickname - это реальный ник владельца поста
          return (
            <div key={p.id} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={{fontSize:18, fontWeight:700}}>
                  {author?.nickname || (p.user_id === user.id ? "Вы" : "без ника")}
                </span>
                <span style={{fontWeight:300, color:"#888", fontSize:14, marginLeft:10}}>
                  {formatKZDate(p.created_at)}
                </span>
              </div>
              <div style={{fontSize: 18, lineHeight: 1.45, marginBottom: 8, wordBreak: "break-word"}}>
                {p.content}
              </div>
              <div style={cardActionsStyle}>
                <button
                  onClick={() => handleLike(p.id)}
                  style={{
                    background:"none",
                    border:"none",
                    color: likedPostIds.includes(p.id) ? "#ff5277" : "#c7c7c7",
                    fontSize:18,
                    display:"flex",
                    alignItems:"center",
                    cursor: "pointer"
                  }}
                  title={likedPostIds.includes(p.id) ? "Убрать лайк" : "Поставить лайк"}
                >
                  <span style={{fontSize:21, marginRight:4}}>❤️</span>
                  {likedPostIds.includes(p.id) ? "Уже нравится" : "Лайк"}
                </button>
                <button
                  onClick={() => handleFavorite(p.id)}
                  style={{
                    background:"none",
                    border:"none",
                    color: favoritePostIds.includes(p.id) ? "#ffd36b" : "#c7c7c7",
                    fontSize:18,
                    display:"flex",
                    alignItems:"center",
                    cursor: "pointer"
                  }}
                  title={favoritePostIds.includes(p.id) ? "Убрать из избранного" : "В избранное"}
                >
                  <span style={{fontSize:21, marginRight:4}}>⭐</span>
                  {favoritePostIds.includes(p.id) ? "В избранном" : "В избранное"}
                </button>
                {/* Можно удалить только свои посты и только на своей странице */}
                {(p.user_id === user.id && (!profileUserId || profileUserId === user.id)) && (
                  <button
                    onClick={() => handleDeletePost(p.id)}
                    style={{
                      marginLeft: "auto",
                      background: "none",
                      border: "none",
                      color: "#ff6464",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 17
                    }}
                  >
                    🗑️ удалить
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* LIKED (тут показываем только для своего профиля) */}
      {(!profileUserId || profileUserId === user?.id) && (
        <>
          <h2 style={{color:"#ffcfd5", marginTop:32, marginBottom: 7, fontWeight:900, letterSpacing:1}}>
            ❤️ Лайкнутые посты
          </h2>
          {likedPosts.length === 0 && <p style={{color:"#bbb", marginBottom:16, marginTop:4}}>Нет лайкнутых постов.</p>}
          {likedPosts.map(p => {
            // Показываем ник автора для каждого лайкнутого поста
            const author = postAuthors[p.user_id]
            return (
              <div key={p.id} style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <span style={{fontWeight:900, color:"#faa"}}>
                    {/* Здесь тоже ник реального автора */}
                    {author?.nickname ? `Понравился пост @${author.nickname}` : "Понравился пост"}
                  </span>
                  <span style={{fontWeight:300, color:"#888", fontSize:14, marginLeft:10}}>
                    {formatKZDate(p.created_at)}
                  </span>
                </div>
                <div style={{fontSize:17, lineHeight:1.42, marginBottom:2}}>
                  {p.content}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* FAVORITES (тут показываем только для своего профиля) */}
      {(!profileUserId || profileUserId === user?.id) && (
        <>
          <h2 style={{color:"#ffedb6", marginTop:28, marginBottom:7, fontWeight:900, letterSpacing:1}}>
            ⭐ Избранное
          </h2>
          {favoritePosts.length === 0 && <p style={{color:"#bbb", marginBottom:16, marginTop:4}}>Нет избранных постов.</p>}
          {favoritePosts.map(p => {
            // Показываем ник автора для избранного поста
            const author = postAuthors[p.user_id]
            return (
              <div key={p.id} style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <span style={{fontWeight:900, color:"#ffdb59"}}>
                    {author?.nickname ? `В избранном @${author.nickname}` : "В избранном"}
                  </span>
                  <span style={{fontWeight:300, color:"#888", fontSize:14, marginLeft:10}}>
                    {formatKZDate(p.created_at)}
                  </span>
                </div>
                <div style={{fontSize:17, lineHeight:1.45, marginBottom:2}}>
                  {p.content}
                </div>
              </div>
            )
          })}
        </>
      )}

    </div>
  )
}
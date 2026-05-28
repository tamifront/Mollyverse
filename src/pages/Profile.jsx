import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { formatKZDate } from "../utils/datetime"
import { POST_SOURCE_PROFILE } from "../utils/postSource"
import { loadAllNicknamesMap } from "../utils/profiles"
import { usePostReactions } from "../hooks/usePostReactions"

// Вынесем оформление отдельного поста как в Posts.jsx (адаптировано)
function PostCard({
  post,
  author,
  user,
  liked,
  favorited,
  onLike,
  onFavorite,
  onDelete,
  canDelete
}) {
  return (
    <div
      style={{
        background: "#191b20",
        borderRadius: 18,
        boxShadow: "0 2px 14px 0 rgba(0,0,0,.14)",
        margin: "18px auto",
        padding: "19px 20px 13px 20px",
        border: "1.5px solid #22242a",
        maxWidth: 540,
        position: "relative",
        color: "#fff"
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 4,
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: 0.15
      }}>
        <span style={{color:"#b1d4fc"}}>
          {author?.nickname || (post.user_id === user.id ? "Вы" : "без ника")}
        </span>
        <span style={{
          fontWeight: 400,
          color: "#8a97ac",
          fontSize: 14,
          marginLeft: 11
        }}>
          {formatKZDate(post.created_at)}
        </span>
        {post.edited && (
          <span style={{color:"#fbdb7e", marginLeft: 12, fontSize:13}} title="Пост был отредактирован"> (изменён)</span>
        )}
      </div>
      <div style={{
        fontSize: 19,
        fontWeight: 400,
        marginBottom: 13,
        lineHeight: 1.42,
        wordBreak: "break-word"
      }}>
        {post.content}
      </div>
      <div style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginTop: 3
      }}>
        <button
          onClick={() => onLike(post.id)}
          style={{
            background:"none",
            border:"none",
            color: liked ? "#ff5277" : "#e1e1e1",
            fontWeight:700,
            fontSize:19,
            display:"flex",
            alignItems:"center",
            cursor: "pointer",
            padding: "2px 7px 2px 0"
          }}
          title={liked ? "Убрать лайк" : "Поставить лайк"}
        >
          <span style={{fontSize:22, marginRight:3}}>❤️</span>{liked ? "Уже нравится" : "Лайк"}
        </button>
        <button
          onClick={() => onFavorite(post.id)}
          style={{
            background:"none",
            border:"none",
            color: favorited ? "#ffd36b" : "#e7e7c7",
            fontWeight:700,
            fontSize:19,
            display:"flex",
            alignItems:"center",
            cursor:"pointer",
            padding: "2px 7px 2px 0"
          }}
          title={favorited ? "Убрать из избранного" : "В избранное"}
        >
          <span style={{fontSize:22, marginRight:3}}>⭐</span>{favorited ? "В избранном" : "В избранное"}
        </button>
        {canDelete && (
          <button
            onClick={() => onDelete(post.id)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "#ff6464",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 18,
              letterSpacing: ".05em"
            }}
          >
            🗑️ удалить
          </button>
        )}
      </div>
    </div>
  )
}

export default function Profile({ user, profileUserId }) {
  // Исправим отображение постов — показываем только посты принадлежащие эффективному пользователю
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

  const {
    likedPostIds,
    favoritePostIds,
    likedPosts,
    favoritePosts,
    toggleLike: handleLike,
    toggleFavorite: handleFavorite,
    refresh: refreshReactions,
  } = usePostReactions(user)

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
      if (profileUserId) {
        setProfile(null)
        setNickname("")
        setBio("")
        return
      }

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

  // ===== ПОСТЫ =====
  const loadPosts = useCallback(async () => {
    if (!effectiveProfileUserId) {
      setPosts([])
      setPostAuthors({})
      return
    }
    // Исправленный: SQL запрос возвращает только посты нужного пользователя!
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", effectiveProfileUserId)
      .order("created_at", { ascending: false })

    if (error) {
      setPosts([])
      return
    }
    setPosts(data || [])

    const nickMap = await loadAllNicknamesMap(user)
    const authorsMap = {}
    for (const [id, nickname] of Object.entries(nickMap)) {
      authorsMap[id] = { id, nickname }
    }
    setPostAuthors(authorsMap)
  }, [effectiveProfileUserId, user])

  const mapUsersById = useCallback(async (ids = []) => {
    if (!ids.length) return []
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nickname")
      .in("id", ids)

    if (error) {
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

    const [{ data: followersData }, { data: followingData }, { data: friendsData }] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("following_id", effectiveProfileUserId),
      supabase.from("follows").select("following_id").eq("follower_id", effectiveProfileUserId),
      supabase.from("friends").select("friend_id").eq("user_id", effectiveProfileUserId),
    ])

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

  useEffect(() => {
    if (!effectiveProfileUserId) {
      setProfile(null)
      setPosts([])
      setPostAuthors({})
      return
    }

    loadProfile()
    loadPosts()
    loadSocial()
  }, [loadPosts, loadProfile, loadSocial, effectiveProfileUserId])

  // ===== СОЗДАНИЕ ПОСТА =====
  const createPost = async () => {
    if (!text.trim()) return alert("Пост не может быть пустым")
    if (profileUserId && profileUserId !== user.id) return alert("Нельзя создавать пост не на своем аккаунте!")

    const payload = {
      user_id: user.id,
      content: text.trim(),
      likes: 0,
      post_source: POST_SOURCE_PROFILE,
    }
    let { error } = await supabase.from("posts").insert(payload)
    if (error) {
      const { error: fallbackError } = await supabase.from("posts").insert({
        user_id: user.id,
        content: text.trim(),
        likes: 0,
      })
      error = fallbackError
    }
    if (error) {
      alert(error.message || "Не удалось создать пост")
      return
    }

    setText("")
    setOpen(false)
    loadPosts()
  }

  // ===== УДАЛИТЬ ПОСТ =====
  const handleDeletePost = async (postId) => {
    const post = posts.find(p => p.id === postId)
    if (!post || post.user_id !== user.id || (profileUserId && profileUserId !== user.id)) return

    const { error } = await supabase.from("posts").delete().eq("id", postId)
    if (error) {
      alert(error.message || "Не удалось удалить пост")
      return
    }

    setPosts(prev => prev.filter(p => p.id !== postId))
    loadPosts()
    refreshReactions()
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
          onSubmit={async (e) => {
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
                setSaveMsg(error?.message || "Ошибка сохранения 😢")
                return
            }

            setProfile(data)
            setNickname(data.nickname || "")
            setBio(data.bio || "")
            setSaveMsg("Сохранено!")
            setEditing(false)
          }}
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

      {/* Показываем только посты effectiveProfileUserId */}
      <div>
        {posts.map(p => {
          const author = postAuthors[p.user_id]
          const canDel = (p.user_id === user.id && (!profileUserId || profileUserId === user.id))
          return (
            <PostCard
              key={p.id}
              post={p}
              author={author}
              user={user}
              liked={likedPostIds.includes(String(p.id))}
              favorited={favoritePostIds.includes(String(p.id))}
              onLike={handleLike}
              onFavorite={handleFavorite}
              onDelete={handleDeletePost}
              canDelete={canDel}
            />
          )
        })}
      </div>

      {/* ЛАЙКНУТЫЕ ПОСТЫ (только свои) */}
      {(!profileUserId || profileUserId === user?.id) && (
        <>
          <h2 style={{color:"#ffcfd5", marginTop:32, marginBottom: 7, fontWeight:900, letterSpacing:1}}>
            ❤️ Лайкнутые посты
          </h2>
          {likedPosts.length === 0 && <p style={{color:"#bbb", marginBottom:16, marginTop:4}}>Нет лайкнутых постов.</p>}
          {likedPosts.map(p => {
            const author = postAuthors[p.user_id]
            return (
              <PostCard
                key={p.id}
                post={p}
                author={author}
                user={user}
                liked={true}
                favorited={favoritePostIds.includes(String(p.id))}
                onLike={handleLike}
                onFavorite={handleFavorite}
                onDelete={() => {}}
                canDelete={false}
              />
            )
          })}
        </>
      )}

      {/* ИЗБРАННОЕ */}
      {(!profileUserId || profileUserId === user?.id) && (
        <>
          <h2 style={{color:"#ffedb6", marginTop:28, marginBottom:7, fontWeight:900, letterSpacing:1}}>
            ⭐ Избранное
          </h2>
          {favoritePosts.length === 0 && <p style={{color:"#bbb", marginBottom:16, marginTop:4}}>Нет избранных постов.</p>}
          {favoritePosts.map(p => {
            const author = postAuthors[p.user_id]
            return (
              <PostCard
                key={p.id}
                post={p}
                author={author}
                user={user}
                liked={likedPostIds.includes(String(p.id))}
                favorited={true}
                onLike={handleLike}
                onFavorite={handleFavorite}
                onDelete={() => {}}
                canDelete={false}
              />
            )
          })}
        </>
      )}

    </div>
  )
}
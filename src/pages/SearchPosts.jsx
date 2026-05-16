import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
// Заменяем import на форматтер для Казахстана
import { getPostAuthorNickname, loadAllNicknamesMap } from "../utils/profiles"

// ———— реальное казахстанское время (Алматы/Астана/Актобе и т.д.) ————
// Функция принудительно отображает время в Казахстане
function formatKZDate(dateStr) {
  if (!dateStr) return ""
  // Force UTC to be parsed, then convert to Kazakhstan TZ (UTC+6)
  const d = new Date(dateStr)
  // Date string is often in ISO 8601, interpreted as UTC by Date
  // Kazakhstan timezone is UTC+6 (Almaty, Astana)
  const utc =
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0") +
    "T" +
    String(d.getUTCHours()).padStart(2, "0") +
    ":" +
    String(d.getUTCMinutes()).padStart(2, "0") +
    ":" +
    String(d.getUTCSeconds()).padStart(2, "0") +
    "Z"
  // Build a Date object for UTC, add +6 offset
  const dt = new Date(utc)
  // +6 hours is 6 * 60 * 60 * 1000 = 21600000 ms
  const msKZ = dt.getTime() + 6 * 60 * 60 * 1000
  const kz = new Date(msKZ)
  // prettify
  const yyyy = kz.getFullYear()
  const mm = String(kz.getMonth() + 1).padStart(2, "0")
  const dd = String(kz.getDate()).padStart(2, "0")
  const hh = String(kz.getHours()).padStart(2, "0")
  const min = String(kz.getMinutes()).padStart(2, "0")
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`
}
// ———————————————————————————————————————————————————————————————

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #232946 0%, #1a1a22 100%)",
    padding: "32px 16px",
    color: "#fff",
  },
  title: {
    fontWeight: 800,
    fontSize: 32,
    margin: "0 0 24px 0",
    textAlign: "center",
  },
  searchWrap: {
    maxWidth: 640,
    margin: "0 auto 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "rgba(34,39,46,0.94)",
    borderRadius: 12,
    padding: "16px 18px",
  },
  input: {
    width: "100%",
    borderRadius: 8,
    border: "1px solid rgba(255,69,0,0.2)",
    padding: "12px 13px",
    fontSize: 16,
    background: "rgba(0,0,0,0.23)",
    color: "#fff",
    outline: "none",
  },
  hint: {
    color: "#cfcfcf",
    fontSize: 13,
    margin: 0,
  },
  postsContainer: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    width: "100%",
    maxWidth: 640,
    marginLeft: "auto",
    marginRight: "auto",
  },
  card: {
    background: "rgba(34,39,46,0.98)",
    borderRadius: 14,
    border: "1px solid rgba(255,69,0,0.13)",
    padding: "18px 20px",
  },
  header: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  nickname: {
    color: "#aac6f6",
    fontWeight: 700,
    fontSize: 16,
  },
  date: {
    color: "#888",
    fontSize: 13,
  },
  content: {
    color: "#ecebed",
    fontSize: 17,
    wordBreak: "break-word",
    whiteSpace: "pre-line",
    margin: 0,
  },
}

export default function SearchPosts({ user }) {
  const [posts, setPosts] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [followingIds, setFollowingIds] = useState([])
  const [friendIds, setFriendIds] = useState([])
  const [actionLoadingId, setActionLoadingId] = useState("")

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
          setPosts(postsData || [])
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id,nickname,bio")

        if (profilesError) {
          console.error("Профили:", profilesError)
        }

        setUsers(profilesData || [])
        setProfilesById(await loadAllNicknamesMap(user))
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


  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🔎 Поиск постов</h1>

      <div style={styles.searchWrap}>
        <input
          style={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Введите слово или ник пользователя..."
        />
        <p style={styles.hint}>
          Поиск работает по тексту поста и по нику автора.
        </p>
      </div>

      <div style={styles.postsContainer}>
        {!loading && query.trim() && (
          <>
            {filteredUsers.length === 0 && <p>Пользователи не найдены.</p>}
            {filteredUsers.map((profile) => (
              <div key={profile.id} style={styles.card}>
                <div style={styles.header}>
                  <span style={styles.nickname}>{profile.nickname || "без ника"}</span>
                </div>
                {profile.bio ? <p style={styles.hint}>{profile.bio}</p> : null}
                {profile.id === user?.id ? (
                  <p style={{ ...styles.hint, marginTop: 8 }}>Это ваш аккаунт</p>
                ) : (
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleToggleFollow(profile.id)}
                      disabled={actionLoadingId === `follow-${profile.id}`}
                      style={{
                        borderRadius: 7,
                        border: "none",
                        background: followingIds.includes(profile.id) ? "#475569" : "#2563eb",
                        color: "#fff",
                        padding: "8px 12px",
                        cursor: "pointer",
                      }}
                    >
                      {followingIds.includes(profile.id) ? "Отписаться" : "Подписаться"}
                    </button>
                    <button
                      onClick={() => handleToggleFriend(profile.id)}
                      disabled={actionLoadingId === `friend-${profile.id}`}
                      style={{
                        borderRadius: 7,
                        border: "none",
                        background: friendIds.includes(profile.id) ? "#b45309" : "#16a34a",
                        color: "#fff",
                        padding: "8px 12px",
                        cursor: "pointer",
                      }}
                    >
                      {friendIds.includes(profile.id) ? "Убрать из друзей" : "Добавить в друзья"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div style={styles.postsContainer}>
        {loading && <p>Загрузка...</p>}
        {!loading && filteredPosts.length === 0 && <p>Ничего не найдено.</p>}

        {!loading &&
          filteredPosts.map((post) => (
            <div key={post.id} style={styles.card}>
              <div style={styles.header}>
                <span style={styles.nickname}>
                  {getPostAuthorNickname(post, profilesById, user)}
                </span>
                <span style={styles.date}>
                  {/* Казахстанское время! */}
                  {formatKZDate(post.created_at)}
                </span>
              </div>
              <p style={styles.content}>{post.content}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

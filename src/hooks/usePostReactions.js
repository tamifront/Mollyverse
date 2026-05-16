import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function lsKey(userId, type) {
  return userId ? `profile_${userId}_${type}` : null
}

function loadLs(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveLs(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function normId(id) {
  return id == null ? "" : String(id)
}

function orderPostsByIds(posts, ids) {
  const byId = {}
  for (const p of posts || []) byId[normId(p.id)] = p
  return ids.map((id) => byId[normId(id)]).filter(Boolean)
}

/** Таблицы post_likes / post_favorites ещё не созданы в Supabase */
function isReactionsTableMissing(error) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") {
    return true
  }
  const msg = (error.message || "").toLowerCase()
  return (
    msg.includes("schema cache") ||
    msg.includes("post_likes") ||
    msg.includes("post_favorites")
  )
}

export function usePostReactions(user) {
  const [likedPostIds, setLikedPostIds] = useState([])
  const [favoritePostIds, setFavoritePostIds] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [favoritePosts, setFavoritePosts] = useState([])
  const [ready, setReady] = useState(false)

  const syncLs = useCallback(
    (likedIds, favIds, likedList, favList) => {
      if (!user?.id) return
      saveLs(lsKey(user.id, "likedPostIds"), likedIds)
      saveLs(lsKey(user.id, "favoritePostIds"), favIds)
      saveLs(lsKey(user.id, "likedPosts"), likedList)
      saveLs(lsKey(user.id, "favoritePosts"), favList)
    },
    [user?.id]
  )

  const loadPostsByIds = useCallback(async (ids) => {
    if (!ids.length) return []
    const { data, error } = await supabase.from("posts").select("*").in("id", ids)
    if (error) return []
    return orderPostsByIds(data, ids)
  }, [])

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLikedPostIds([])
      setFavoritePostIds([])
      setLikedPosts([])
      setFavoritePosts([])
      setReady(true)
      return
    }

    const [{ data: likes, error: likesErr }, { data: favs, error: favsErr }] =
      await Promise.all([
        supabase.from("post_likes").select("post_id").eq("user_id", user.id),
        supabase.from("post_favorites").select("post_id").eq("user_id", user.id),
      ])

    const useLocal =
      isReactionsTableMissing(likesErr) || isReactionsTableMissing(favsErr)

    let likedIds = useLocal
      ? loadLs(lsKey(user.id, "likedPostIds"), [])
      : (likes || []).map((r) => normId(r.post_id))
    let favIds = useLocal
      ? loadLs(lsKey(user.id, "favoritePostIds"), [])
      : (favs || []).map((r) => normId(r.post_id))

    const [likedList, favList] = await Promise.all([
      loadPostsByIds(likedIds),
      loadPostsByIds(favIds),
    ])

    setLikedPostIds(likedIds)
    setFavoritePostIds(favIds)
    setLikedPosts(likedList)
    setFavoritePosts(favList)
    syncLs(likedIds, favIds, likedList, favList)
    setReady(true)
  }, [loadPostsByIds, syncLs, user?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const toggleLike = useCallback(
    async (postId) => {
      if (!user?.id || !postId) return

      const pid = normId(postId)
      const already = likedPostIds.includes(pid)
      if (already) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId)
        if (error && !isReactionsTableMissing(error)) {
          alert(error.message || "Не удалось убрать лайк")
          return
        }
      } else {
        const { error } = await supabase.from("post_likes").insert({
          user_id: user.id,
          post_id: postId,
        })
        if (error && !isReactionsTableMissing(error)) {
          alert(error.message || "Не удалось поставить лайк")
          return
        }
      }

      const nextIds = already
        ? likedPostIds.filter((id) => id !== pid)
        : [...likedPostIds, pid]
      setLikedPostIds(nextIds)
      saveLs(lsKey(user.id, "likedPostIds"), nextIds)

      let nextLikedPosts = likedPosts.filter((p) => normId(p.id) !== pid)
      if (!already) {
        const { data: postRow } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postId)
          .maybeSingle()
        if (postRow) nextLikedPosts = [...nextLikedPosts, postRow]
      }
      setLikedPosts(nextLikedPosts)
      saveLs(lsKey(user.id, "likedPosts"), nextLikedPosts)

      await refresh()
    },
    [likedPostIds, likedPosts, refresh, user?.id]
  )

  const toggleFavorite = useCallback(
    async (postId) => {
      if (!user?.id || !postId) return

      const pid = normId(postId)
      const already = favoritePostIds.includes(pid)
      if (already) {
        const { error } = await supabase
          .from("post_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId)
        if (error && !isReactionsTableMissing(error)) {
          alert(error.message || "Не удалось убрать из избранного")
          return
        }
      } else {
        const { error } = await supabase.from("post_favorites").insert({
          user_id: user.id,
          post_id: postId,
        })
        if (error && !isReactionsTableMissing(error)) {
          alert(error.message || "Не удалось добавить в избранное")
          return
        }
      }

      const nextIds = already
        ? favoritePostIds.filter((id) => id !== pid)
        : [...favoritePostIds, pid]
      setFavoritePostIds(nextIds)
      saveLs(lsKey(user.id, "favoritePostIds"), nextIds)

      let nextFavoritePosts = favoritePosts.filter((p) => normId(p.id) !== pid)
      if (!already) {
        const { data: postRow } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postId)
          .maybeSingle()
        if (postRow) nextFavoritePosts = [...nextFavoritePosts, postRow]
      }
      setFavoritePosts(nextFavoritePosts)
      saveLs(lsKey(user.id, "favoritePosts"), nextFavoritePosts)

      await refresh()
    },
    [favoritePostIds, favoritePosts, refresh, user?.id]
  )

  return {
    ready,
    likedPostIds,
    favoritePostIds,
    likedPosts,
    favoritePosts,
    toggleLike,
    toggleFavorite,
    refresh,
  }
}

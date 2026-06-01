import { supabase } from "../lib/supabase"

/** Количество лайков по post_id */
export async function getLikeCountsForPosts(postIds) {
  if (!postIds?.length) return {}
  const { data: likeRows, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds)

  if (error || !Array.isArray(likeRows)) return {}

  const counts = {}
  const seen = new Set()
  for (const { post_id, user_id } of likeRows) {
    const key = `${post_id}:${user_id}`
    if (seen.has(key)) continue
    seen.add(key)
    counts[post_id] = (counts[post_id] || 0) + 1
  }
  return counts
}

/** Список пользователей, лайкнувших каждый пост: { [postId]: [{ id, nickname }] } */
export async function loadLikesMapForPosts(postList) {
  if (!postList?.length) return {}

  const postIds = postList.map((p) => p.id).filter(Boolean)
  if (!postIds.length) return {}

  const { data: likeRows, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds)

  if (error || !likeRows?.length) return {}

  const userIds = [...new Set(likeRows.map((r) => r.user_id).filter(Boolean))]
  let profileById = {}
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", userIds)
    for (const p of profiles || []) {
      profileById[p.id] = p
    }
  }

  const map = {}
  for (const row of likeRows) {
    if (!map[row.post_id]) map[row.post_id] = []
    const prof = profileById[row.user_id]
    map[row.post_id].push({
      id: row.user_id,
      nickname: prof?.nickname || "без ника",
      avatar_url: prof?.avatar_url?.trim() || "",
    })
  }
  return map
}

/** Количество сохранений в избранное по post_id */
export async function getFavoriteCountsForPosts(postIds) {
  if (!postIds?.length) return {}
  const { data: favRows, error } = await supabase
    .from("post_favorites")
    .select("post_id, user_id")
    .in("post_id", postIds)

  if (error || !Array.isArray(favRows)) return {}

  const counts = {}
  const seen = new Set()
  for (const { post_id, user_id } of favRows) {
    const key = `${post_id}:${user_id}`
    if (seen.has(key)) continue
    seen.add(key)
    counts[post_id] = (counts[post_id] || 0) + 1
  }
  return counts
}

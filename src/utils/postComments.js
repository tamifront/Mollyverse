import { supabase } from "../lib/supabase"

function isCommentsTableMissing(error) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") {
    return true
  }
  const msg = (error.message || "").toLowerCase()
  return msg.includes("schema cache") || msg.includes("post_comments")
}

/** Количество комментариев по post_id */
export async function getCommentCountsForPosts(postIds) {
  if (!postIds?.length) return {}

  const { data, error } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", postIds)

  if (error) {
    if (isCommentsTableMissing(error)) return {}
    console.error("comment counts:", error)
    return {}
  }

  const counts = {}
  for (const row of data || []) {
    counts[row.post_id] = (counts[row.post_id] || 0) + 1
  }
  return counts
}

/** Комментарии одного поста (от старых к новым) */
export async function loadCommentsForPost(postId) {
  if (!postId) return []

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (error) {
    if (isCommentsTableMissing(error)) return []
    throw error
  }

  return data || []
}

export async function addPostComment(postId, userId, content) {
  const trimmed = (content || "").trim()
  if (!postId || !userId || !trimmed) {
    return { data: null, error: new Error("Пустой комментарий") }
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: userId,
      content: trimmed,
    })
    .select("id, post_id, user_id, content, created_at")
    .single()

  return { data, error }
}

export async function deletePostComment(commentId, userId) {
  if (!commentId || !userId) {
    return { error: new Error("Нет данных") }
  }

  return supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId)
}

export { isCommentsTableMissing }

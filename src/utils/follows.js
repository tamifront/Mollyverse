import { supabase } from "../lib/supabase"

export async function checkIsFollowing(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return false
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .maybeSingle()
  return Boolean(data)
}

export async function getFollowRequestStatus(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return null
  const { data } = await supabase
    .from("follow_requests")
    .select("status")
    .eq("requester_id", viewerId)
    .eq("target_id", targetId)
    .maybeSingle()
  return data?.status ?? null
}

export async function requestFollow(viewerId, targetId) {
  // Удаляем старый запрос (rejected/approved), затем создаём новый —
  // upsert ломается из‑за RLS на UPDATE для requester
  await supabase
    .from("follow_requests")
    .delete()
    .eq("requester_id", viewerId)
    .eq("target_id", targetId)

  const { error } = await supabase.from("follow_requests").insert({
    requester_id: viewerId,
    target_id: targetId,
    status: "pending",
  })
  return { error }
}

export async function cancelFollowRequest(viewerId, targetId) {
  const { error } = await supabase
    .from("follow_requests")
    .delete()
    .eq("requester_id", viewerId)
    .eq("target_id", targetId)
  return { error }
}

export async function unfollow(viewerId, targetId) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
  return { error }
}

export async function followPublic(viewerId, targetId) {
  const { error } = await supabase.from("follows").insert({
    follower_id: viewerId,
    following_id: targetId,
  })
  return { error }
}

export async function approveFollowRequest(requestId) {
  const { error } = await supabase.rpc("approve_follow_request", {
    p_request_id: requestId,
  })
  return { error }
}

export async function rejectFollowRequest(requestId) {
  const { error } = await supabase
    .from("follow_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
  return { error }
}

export async function loadPendingFollowRequests(userId) {
  const { data, error } = await supabase
    .from("follow_requests")
    .select("id, requester_id, created_at")
    .eq("target_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  return { data: data || [], error }
}

export function canViewProfileContent({ isOwnProfile, isPrivate, isFollowing }) {
  if (isOwnProfile) return true
  if (!isPrivate) return true
  return isFollowing
}

export async function loadPostsByUserReaction(userId, table) {
  if (!userId) return []
  const { data: rows, error } = await supabase
    .from(table)
    .select("post_id")
    .eq("user_id", userId)
  if (error || !rows?.length) return []

  const postIds = rows.map((r) => r.post_id)
  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*")
    .in("id", postIds)
    .order("created_at", { ascending: false })
  if (postsError) return []

  const byId = Object.fromEntries((posts || []).map((p) => [String(p.id), p]))
  return postIds.map((id) => byId[String(id)]).filter(Boolean)
}

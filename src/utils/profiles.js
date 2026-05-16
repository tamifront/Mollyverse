import { supabase } from "../lib/supabase"

/** Карта userId → nickname */
export async function fetchNicknamesByUserIds(userIds = []) {
  const unique = [...new Set(userIds.filter(Boolean))]
  const map = {}
  if (!unique.length) return map

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname")
    .in("id", unique)

  if (!error && data?.length) {
    for (const row of data) {
      map[row.id] = row.nickname?.trim() || "без ника"
    }
  }

  const missing = unique.filter((id) => !map[id])
  if (missing.length) {
    const { data: allProfiles, error: allError } = await supabase
      .from("profiles")
      .select("id, nickname")

    if (!allError && allProfiles?.length) {
      for (const row of allProfiles) {
        if (missing.includes(row.id)) {
          map[row.id] = row.nickname?.trim() || "без ника"
        }
      }
    }
  }

  return map
}

export function getPostAuthorNickname(post, profilesById, currentUser) {
  const uid = post?.user_id
  if (uid && profilesById[uid]) return profilesById[uid]
  if (uid && currentUser?.id === uid) {
    return (
      profilesById[uid] ||
      currentUser.user_metadata?.nickname?.trim() ||
      "Вы"
    )
  }
  const embedded = post?.profiles
  if (embedded) {
    const row = Array.isArray(embedded) ? embedded[0] : embedded
    if (row?.nickname) return String(row.nickname).trim()
  }
  return "без ника"
}

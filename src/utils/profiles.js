import { supabase } from "../lib/supabase"

/** Загрузить все ники разом (надёжнее для ленты и поиска) */
export async function loadAllNicknamesMap(currentUser) {
  const map = {}

  const { data, error } = await supabase.from("profiles").select("id, nickname")
  if (!error) {
    for (const row of data || []) {
      if (row?.id) map[row.id] = row.nickname?.trim() || "без ника"
    }
  }

  if (currentUser?.id) {
    if (!map[currentUser.id]) {
      const { data: mine } = await supabase
        .from("profiles")
        .select("id, nickname")
        .eq("id", currentUser.id)
        .maybeSingle()
      if (mine?.nickname?.trim()) {
        map[currentUser.id] = mine.nickname.trim()
      } else if (currentUser.user_metadata?.nickname) {
        map[currentUser.id] = String(currentUser.user_metadata.nickname).trim()
      } else if (currentUser.email) {
        map[currentUser.id] = currentUser.email.split("@")[0]
      } else {
        map[currentUser.id] = "Вы"
      }
    }
  }

  return map
}

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
  if (currentUser?.email) return currentUser.email.split("@")[0]
  return "без ника"
}

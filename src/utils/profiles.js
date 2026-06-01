import { supabase } from "../lib/supabase"

export function getAvatarLetter(name) {
  if (!name) return "U"
  return String(name).trim()[0]?.toUpperCase() || "U"
}

/** Нормализовать запись профиля (строка-ник или объект) */
export function normalizeProfileEntry(entry) {
  if (!entry) return { nickname: "без ника", avatar_url: "" }
  if (typeof entry === "string") {
    return { nickname: entry.trim() || "без ника", avatar_url: "" }
  }
  return {
    nickname: entry.nickname?.trim() || "без ника",
    avatar_url: entry.avatar_url?.trim() || "",
  }
}

export function getProfileFromMap(profilesById, userId) {
  if (!userId) return { nickname: "без ника", avatar_url: "" }
  return normalizeProfileEntry(profilesById?.[userId])
}

/** Загрузить id → { nickname, avatar_url } */
export async function loadAllProfilesMap(currentUser) {
  const map = {}

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")

  if (!error) {
    for (const row of data || []) {
      if (row?.id) {
        map[row.id] = normalizeProfileEntry(row)
      }
    }
  }

  if (currentUser?.id) {
    if (!map[currentUser.id]) {
      const { data: mine } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .eq("id", currentUser.id)
        .maybeSingle()

      if (mine) {
        map[currentUser.id] = normalizeProfileEntry(mine)
      } else {
        map[currentUser.id] = {
          nickname:
            currentUser.user_metadata?.nickname?.trim() ||
            (currentUser.email ? currentUser.email.split("@")[0] : "Вы"),
          avatar_url: currentUser.user_metadata?.avatar_url?.trim() || "",
        }
      }
    }
  }

  return map
}

/** @deprecated используй loadAllProfilesMap — оставлено для совместимости */
export async function loadAllNicknamesMap(currentUser) {
  const profiles = await loadAllProfilesMap(currentUser)
  const nickMap = {}
  for (const [id, prof] of Object.entries(profiles)) {
    nickMap[id] = prof.nickname
  }
  return nickMap
}

/** Карта userId → { nickname, avatar_url } */
export async function fetchProfilesByUserIds(userIds = []) {
  const unique = [...new Set(userIds.filter(Boolean))]
  const map = {}
  if (!unique.length) return map

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", unique)

  if (!error && data?.length) {
    for (const row of data) {
      map[row.id] = normalizeProfileEntry(row)
    }
  }

  const missing = unique.filter((id) => !map[id])
  if (missing.length) {
    const { data: allProfiles, error: allError } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url")

    if (!allError && allProfiles?.length) {
      for (const row of allProfiles) {
        if (missing.includes(row.id)) {
          map[row.id] = normalizeProfileEntry(row)
        }
      }
    }
  }

  return map
}

/** @deprecated */
export async function fetchNicknamesByUserIds(userIds = []) {
  const profiles = await fetchProfilesByUserIds(userIds)
  const nickMap = {}
  for (const [id, prof] of Object.entries(profiles)) {
    nickMap[id] = prof.nickname
  }
  return nickMap
}

export function getPostAuthorNickname(post, profilesById, currentUser) {
  const uid = post?.user_id
  if (uid && profilesById?.[uid]) {
    return getProfileFromMap(profilesById, uid).nickname
  }
  if (uid && currentUser?.id === uid) {
    return (
      getProfileFromMap(profilesById, uid).nickname ||
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

export function getPostAuthorAvatar(post, profilesById, currentUser) {
  const uid = post?.user_id
  if (uid && profilesById?.[uid]) {
    return getProfileFromMap(profilesById, uid).avatar_url
  }
  if (uid && currentUser?.id === uid) {
    return currentUser.user_metadata?.avatar_url?.trim() || ""
  }
  const embedded = post?.profiles
  if (embedded) {
    const row = Array.isArray(embedded) ? embedded[0] : embedded
    if (row?.avatar_url) return String(row.avatar_url).trim()
  }
  return ""
}

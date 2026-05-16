const lastReadKey = (userId) => `mollyverse_updates_read_${userId}`

function parseTime(value) {
  if (!value) return NaN
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : NaN
}

export function getLastReadUpdatesAt(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(lastReadKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && parsed.readAt) {
      return parsed.readAt
    }
    return raw
  } catch {
    return null
  }
}

/** Сохранить время последнего просмотренного обновления (created_at из Supabase) */
export function markUpdatesAsRead(userId, latestCreatedAt) {
  if (!userId || !latestCreatedAt) return
  try {
    localStorage.setItem(
      lastReadKey(userId),
      JSON.stringify({ readAt: latestCreatedAt })
    )
  } catch {}
  window.dispatchEvent(new CustomEvent("updates-read"))
}

export function hasUnreadUpdates(latestCreatedAt, userId) {
  if (!latestCreatedAt || !userId) return false

  const lastRead = getLastReadUpdatesAt(userId)
  if (!lastRead) return true

  const latestMs = parseTime(latestCreatedAt)
  const readMs = parseTime(lastRead)
  if (Number.isNaN(latestMs) || Number.isNaN(readMs)) return false

  return latestMs > readMs
}

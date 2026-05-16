const lastReadKey = (userId) => `mollyverse_updates_read_${userId}`

export function getLastReadUpdatesAt(userId) {
  if (!userId) return null
  try {
    return localStorage.getItem(lastReadKey(userId))
  } catch {
    return null
  }
}

export function markUpdatesAsRead(userId, latestCreatedAt) {
  if (!userId) return
  const value = latestCreatedAt || new Date().toISOString()
  try {
    localStorage.setItem(lastReadKey(userId), value)
  } catch {}
  window.dispatchEvent(new CustomEvent("updates-read"))
}

export function hasUnreadUpdates(latestCreatedAt, userId) {
  if (!latestCreatedAt || !userId) return false
  const lastRead = getLastReadUpdatesAt(userId)
  if (!lastRead) return true
  return new Date(latestCreatedAt).getTime() > new Date(lastRead).getTime()
}

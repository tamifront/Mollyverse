export function formatKZDate(dateValue) {
  if (!dateValue) return ""

  try {
    const date = new Date(dateValue)
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Almaty",
    }).format(date)
  } catch {
    return ""
  }
}

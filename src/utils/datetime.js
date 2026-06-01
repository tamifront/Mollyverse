const KZ_TZ = "Asia/Almaty"

/** dd.mm.yyyy HH:mm в часовом поясе Казахстана (Алматы) */
export function formatKZDateAlmaty(dt) {
  if (!dt) return ""
  try {
    let dateObj
    if (typeof dt === "string") {
      if (!dt.endsWith("Z") && !dt.includes("+")) {
        dateObj = new Date(dt.includes("T") ? dt + "Z" : dt)
      } else {
        dateObj = new Date(dt)
      }
    } else if (dt instanceof Date) {
      dateObj = dt
    } else {
      return ""
    }

    if (Number.isNaN(dateObj.getTime())) return ""

    const options = {
      timeZone: KZ_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
    const parts = new Intl.DateTimeFormat("ru-RU", options).formatToParts(dateObj)
    const get = (type) => parts.find((p) => p.type === type)?.value ?? ""
    return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`
  } catch {
    return ""
  }
}

/** Алиас для единого формата даты по всему приложению */
export function formatKZDate(dateValue) {
  return formatKZDateAlmaty(dateValue)
}

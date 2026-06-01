import { supabase } from "../lib/supabase"

const BUCKET = "avatars"
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export function validateAvatarFile(file) {
  if (!file) return "Выберите файл"
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Поддерживаются JPG, PNG, WebP или GIF"
  }
  if (file.size > MAX_BYTES) return "Файл слишком большой (макс. 2 МБ)"
  return null
}

function extFromFile(file) {
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }
  return byType[file.type] || "jpg"
}

/** Загрузить аватар в Storage и сохранить URL в profiles.avatar_url */
export async function uploadProfileAvatar(userId, file) {
  const validation = validateAvatarFile(file)
  if (validation) return { url: null, error: new Error(validation) }
  if (!userId) return { url: null, error: new Error("Нет пользователя") }

  const path = `${userId}/avatar.${extFromFile(file)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type })

  if (uploadError) return { url: null, error: uploadError }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const baseUrl = urlData?.publicUrl || ""
  const avatarUrl = baseUrl ? `${baseUrl}?v=${Date.now()}` : ""

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)

  if (profileError) return { url: null, error: profileError }

  return { url: avatarUrl, error: null }
}

export async function removeProfileAvatar(userId) {
  if (!userId) return { error: new Error("Нет пользователя") }

  const { data: files } = await supabase.storage.from(BUCKET).list(userId)
  if (files?.length) {
    const paths = files.map((f) => `${userId}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(paths)
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: "" })
    .eq("id", userId)

  return { error }
}

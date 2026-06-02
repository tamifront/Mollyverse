import { supabase } from "../lib/supabase"

const BUCKET = "post-images"
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export function validatePostImage(file) {
  if (!file) return null
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Можно загружать только JPG, PNG, WebP или GIF"
  }
  if (file.size > MAX_BYTES) {
    return "Фото слишком большое (максимум 8 МБ)"
  }
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

export async function uploadPostImage(userId, file) {
  if (!userId || !file) return { url: "", error: null }
  const validationError = validatePostImage(file)
  if (validationError) return { url: "", error: new Error(validationError) }

  const ext = extFromFile(file)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false })

  if (uploadError) return { url: "", error: uploadError }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data?.publicUrl || "", error: null, path }
}

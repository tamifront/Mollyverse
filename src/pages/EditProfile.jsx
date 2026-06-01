import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { uploadProfileAvatar, removeProfileAvatar } from "../utils/avatars"
import UserAvatar from "../components/UserAvatar"

export default function EditProfile({ user, profile, onUpdated, onClose }) {
  const [nickname, setNickname] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "")
      setBio(profile.bio ?? "")
      setAvatarUrl(profile.avatar_url ?? "")
    }
  }, [profile])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setAvatarUploading(true)
    const { url, error } = await uploadProfileAvatar(user.id, file)
    setAvatarUploading(false)
    if (error) {
      alert(error.message || "Не удалось загрузить аватар")
      return
    }
    setAvatarUrl(url)
    e.target.value = ""
  }

  async function handleAvatarRemove() {
    if (!user?.id) return
    setAvatarUploading(true)
    const { error } = await removeProfileAvatar(user.id)
    setAvatarUploading(false)
    if (error) {
      alert(error.message || "Не удалось удалить аватар")
      return
    }
    setAvatarUrl("")
  }

  async function saveProfile() {
    if (!user?.id) {
      alert("No user")
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          nickname: nickname?.trim() || "без ника",
          bio: bio?.trim() || "",
          avatar_url: avatarUrl?.trim() || "",
        },
        { onConflict: "id" }
      )

    setSaving(false)

    if (error) {
      console.log(error)
      alert(error.message)
      return
    }

    await onUpdated?.()
    onClose?.()
  }

  return (
    <div className="edit-overlay">
      <div className="edit-modal">

        <h2>Редактировать профиль</h2>

        <div className="profile-avatar-edit">
          <UserAvatar nickname={nickname || "без ника"} avatarUrl={avatarUrl} size="lg" />
          <div className="profile-avatar-edit-actions">
            <label className="mv-btn mv-btn--ghost profile-avatar-upload-label">
              {avatarUploading ? "Загрузка..." : "Сменить фото"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="profile-avatar-file-input"
                disabled={avatarUploading || saving}
                onChange={handleAvatarChange}
              />
            </label>
            {avatarUrl ? (
              <button
                type="button"
                className="mv-btn mv-btn--ghost"
                disabled={avatarUploading || saving}
                onClick={handleAvatarRemove}
              >
                Убрать фото
              </button>
            ) : null}
          </div>
        </div>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Ник"
        />

        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="О себе"
        />

        <button onClick={saveProfile} disabled={saving}>
          {saving ? "Сохраняем..." : "💾 Сохранить"}
        </button>

        <button onClick={onClose} disabled={saving}>
          ❌ Закрыть
        </button>

      </div>
    </div>
  )
}

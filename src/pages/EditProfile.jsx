import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

export default function EditProfile({ user, profile, onUpdated, onClose }) {
  const [nickname, setNickname] = useState("")
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)

  // безопасная инициализация
  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "")
      setBio(profile.bio ?? "")
    }
  }, [profile])

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
          bio: bio?.trim() || ""
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
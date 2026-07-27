import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import {
  approveFollowRequest,
  loadPendingFollowRequests,
  rejectFollowRequest,
} from "../utils/follows"
import { normalizeProfileEntry } from "../utils/profiles"
import UserAvatar from "../components/UserAvatar"
import "../styles/Settings.css"

export default function Settings({ user }) {
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [requests, setRequests] = useState([])
  const [requestProfiles, setRequestProfiles] = useState({})
  const [actionId, setActionId] = useState("")

  const loadSettings = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const [{ data: profile }, { data: pending }] = await Promise.all([
      supabase.from("profiles").select("is_private").eq("id", user.id).maybeSingle(),
      loadPendingFollowRequests(user.id),
    ])

    setIsPrivate(Boolean(profile?.is_private))
    setRequests(pending)

    const ids = pending.map((r) => r.requester_id)
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", ids)
      const map = {}
      for (const row of profiles || []) {
        map[row.id] = normalizeProfileEntry(row)
      }
      setRequestProfiles(map)
    } else {
      setRequestProfiles({})
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  async function togglePrivate() {
    if (!user?.id) return
    setSaving(true)
    const next = !isPrivate
    const { error } = await supabase
      .from("profiles")
      .update({ is_private: next })
      .eq("id", user.id)
    setSaving(false)
    if (error) {
      alert(error.message || "Не удалось сохранить настройки")
      return
    }
    setIsPrivate(next)
  }

  async function handleApprove(req) {
    setActionId(req.id)
    const { error } = await approveFollowRequest(req.id)
    setActionId("")
    if (error) {
      alert(error.message || "Не удалось одобрить запрос")
      return
    }
    await loadSettings()
  }

  async function handleReject(req) {
    setActionId(req.id)
    const { error } = await rejectFollowRequest(req.id)
    setActionId("")
    if (error) {
      alert(error.message || "Не удалось отклонить запрос")
      return
    }
    await loadSettings()
  }

  if (loading) {
    return (
      <div className="settings-page">
        <p className="mv-empty">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Настройки</h1>
      </header>

      <section className="mv-panel settings-section">
        <h2>Приватность аккаунта</h2>
        <p className="settings-desc">
          Если аккаунт приватный, другие пользователи не увидят ваши посты, пока вы
          не одобрите их запрос на подписку.
        </p>
        <label className="settings-toggle-row">
          <span>Приватный аккаунт</span>
          <button
            type="button"
            className={`settings-toggle${isPrivate ? " is-on" : ""}`}
            onClick={togglePrivate}
            disabled={saving}
            aria-pressed={isPrivate}
          >
            <span className="settings-toggle-knob" />
          </button>
        </label>
      </section>

      <section className="mv-panel settings-section">
        <h2>Запросы на подписку ({requests.length})</h2>
        {requests.length === 0 ? (
          <p className="mv-hint" style={{ padding: 0, textAlign: "left" }}>
            Новых запросов нет.
          </p>
        ) : (
          <ul className="settings-requests">
            {requests.map((req) => {
              const prof = requestProfiles[req.requester_id] || {
                nickname: "без ника",
                avatar_url: "",
              }
              return (
                <li key={req.id} className="settings-request-row">
                  <UserAvatar
                    nickname={prof.nickname}
                    avatarUrl={prof.avatar_url}
                    size="sm"
                  />
                  <span className="settings-request-name">{prof.nickname}</span>
                  <div className="settings-request-actions">
                    <button
                      type="button"
                      className="mv-btn mv-btn--primary"
                      disabled={actionId === req.id}
                      onClick={() => handleApprove(req)}
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      className="mv-btn mv-btn--ghost"
                      disabled={actionId === req.id}
                      onClick={() => handleReject(req)}
                    >
                      Отклонить
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

import "../styles/Sidebar.css"
import { useState } from "react"

export default function Sidebar({ setPage, updatesUnread = false }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const goToPage = (page) => {
    setPage(page)
    setIsMobileOpen(false)
  }

  return (
    <>
      <button
        className="burger-button"
        onClick={() => setIsMobileOpen((prev) => !prev)}
        aria-label="Открыть меню"
      >
        ☰
      </button>

      {isMobileOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Закрыть меню"
        />
      )}

      <div className={`sidebar ${isMobileOpen ? "open" : ""}`}>
        <button onClick={() => goToPage("home")}>
          🏠 Главная
        </button>

        <button onClick={() => goToPage("posts")}>
          📝 Лента
        </button>

        <button
          type="button"
          className={`sidebar-nav-btn ${updatesUnread ? "updates-unread" : ""}`}
          onClick={() => goToPage("updates")}
        >
          <span>📢 Обновления</span>
          {updatesUnread && <span className="updates-unread-dot" aria-hidden />}
        </button>

        <button onClick={() => goToPage("search-posts")}>
          🔎 Поиск постов
        </button>

        <button onClick={() => goToPage("profile")}>
          👤 Профиль
        </button>
      </div>
    </>
  )
}
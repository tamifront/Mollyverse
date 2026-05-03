import "../styles/Sidebar.css"
import { useState } from "react"

export default function Sidebar({ setPage }) {
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

        <button onClick={() => goToPage("updates")}>
          📢 Обновления
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
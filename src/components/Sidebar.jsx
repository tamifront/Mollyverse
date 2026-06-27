import { useState } from "react";
import "../styles/Sidebar.css";
import LogoutConfirm from "./LogoutConfirm";
import { ContactRound, PawPrint, Bomb, Search, CalendarPlus2, LogOut, Settings as SettingsIcon } from "lucide-react";

export default function Sidebar({
  user,
  setPage,
  onOpenOwnProfile,
  updatesUnread = false,
  onOpenUpdates,
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const goToPage = (page) => {
    setPage(page);
    setIsMobileOpen(false);
  };

  // Пояснения:
  // "Обновления" съехали вправо из-за justify-content: space-between у .sidebar-nav-btn (см. Sidebar.css).
  // Это правило заставляет первый и последний элемент (span + dot) "расталкивать" друг друга по краям.
  // Если не нужен space-between — убери/замени это правило или задай display: flex/gap только для иконки и текста.

  return (
    <>
      {/* Кнопка бургера для мобильного меню */}
      <button
        className="burger-button"
        onClick={() => setIsMobileOpen((prev) => !prev)}
        aria-label="Открыть меню"
        type="button"
      >
        ☰
      </button>

      {/* Оверлей для закрытия меню на мобильных устройствах */}
      {isMobileOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Закрыть меню"
          type="button"
        />
      )}

      <div className={`sidebar${isMobileOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-dot" aria-hidden="true" />
          <span className="sidebar-brand-text">Mollyverse</span>
        </div>

        <button type="button" onClick={() => goToPage("home")}>
          <PawPrint size={20} strokeWidth={1.5} />
          <span>Главная</span>
        </button>

        <button type="button" onClick={() => goToPage("posts")}>
          <Bomb
            size={20}
            strokeWidth={1.5}
            color="#ec8846"
            style={{ marginRight: 6 }}
          />
          <span>Лента</span>
        </button>

        <button
          type="button"
          // убираем sidebar-nav-btn (именно он выставляет space-between, что "расделяет" иконку/текст/dot)
          className={updatesUnread ? "updates-unread" : ""}
          onClick={() => {
            if (onOpenUpdates) onOpenUpdates();
            goToPage("updates");
          }}
          style={{ display: "flex", alignItems: "center", gap: 10 }} // явно задаём gap между иконкой, текстом и dot
        >
          <CalendarPlus2
            size={20}
            strokeWidth={1.5}
            color="#ec8846"
            style={{ marginRight: 6 }}
          />
          <span>Обновления</span>
          {updatesUnread && (
            <span
              className="updates-unread-dot"
              aria-hidden="true"
              style={{ marginLeft: 6 }}
            />
          )}
        </button>

        <button type="button" onClick={() => goToPage("search-posts")}>
          <Search
            size={20}
            strokeWidth={1.5}
            color="#ffffff"
            style={{ marginRight: 6 }}
          />
          <span>Поиск постов</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenOwnProfile?.()
            goToPage("profile")
          }}
          className="flex items-center gap-2"
        >
          <ContactRound size={20} strokeWidth={1.5} />
          <span>Профиль</span>
        </button>

        <button type="button" onClick={() => goToPage("settings")}>
          <SettingsIcon size={20} strokeWidth={1.5} />
          <span>Настройки</span>
        </button>

        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => {
            setLogoutOpen(true);
            setIsMobileOpen(false);
          }}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <LogOut size={20} strokeWidth={1.5} style={{ marginRight: 6 }} />
          <span>Выйти</span>
        </button>
      </div>

      <LogoutConfirm
        user={user}
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
      />
    </>
  );
}
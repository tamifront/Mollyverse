import { useEffect, useState } from "react"
import logo from "../assets/logo.png"
import "../styles/Home.css"

const QUOTES = [
  "мороженое, лимонад, собаки?...",
  "В мире все хорошо если есть собака!",
  "Если ничего не работает, мой песик сломал код:(",
  "Каждому нужен пушистый друг рядом!",
  "Счастье — это хвост, который всегда виляет.",
  "Беру лапу в лапу и бегу к приключениям!",
  "Если день не удался, обними собаку.",
  "Лаем на проблемы, хвостом — на радость!",
  "Сначала погладь собаку, потом решай задачи.",
]

const FEATURES = [
  { icon: "📝", text: "Пиши посты в ленте и в профиле — делись мыслями и находками" },
  { icon: "❤️", text: "Ставь лайки и сохраняй посты в избранное" },
  { icon: "🔎", text: "Ищи людей и посты, подписывайся и добавляй в друзья" },
  { icon: "📢", text: "Следи за обновлениями Mollyverse — там всё самое важное" },
]

export default function Home() {
  const [quote, setQuote] = useState("")

  useEffect(() => {
    const randIdx = Math.floor(Math.random() * QUOTES.length)
    setQuote(QUOTES[randIdx])
  }, [])

  return (
    <div className="home-container">
      <header className="home-topbar">
        <div className="home-brand">
          <img src={logo} alt="Mollyverse" className="home-logo" />
          <span>Mollyverse</span>
        </div>
      </header>

      <main className="home-card home-card-wide">

        <h1 className="home-title">
          Добро пожаловать в Mollyverse <span className="home-wave">🐾</span>
        </h1>

        <p className="home-lead">
          Уютное место в интернете для тёплых историй, смешных мыслей и людей,
          которым нравятся собаки, мороженое и хорошее настроение.
        </p>

        <p className="home-text">
          Здесь можно вести свой профиль, читать ленту, находить друзей и не
          пропускать важные новости проекта. Всё просто, по-дружески и без лишней
          суеты — заходи, пиши пост и оставайся с нами.
        </p>

        <ul className="home-features">
          {FEATURES.map((item) => (
            <li key={item.text} className="home-feature">
              <span className="home-feature-icon" aria-hidden>
                {item.icon}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        <p className="home-quote">«{quote}»</p>

        <p className="home-hint">
          Открой меню слева: начни с <strong>ленты</strong> или загляни в{" "}
          <strong>профиль</strong> — тебя уже ждут.
        </p>
      </main>
    </div>
  )
}

import { useEffect, useState } from "react"
import logo from "../assets/logo.png"

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

export default function Home({ user }) {
  const [quote, setQuote] = useState("")

  useEffect(() => {
    // Выбираем случайную цитату при каждом рендере компонента
    const randIdx = Math.floor(Math.random() * QUOTES.length)
    setQuote(QUOTES[randIdx])
  }, [])

  const styles = {
    container: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      color: "white",
      background: "#0b0b0f",
      flexDirection: "column"
    },
    topbar: {
      width: "100%",
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      position: "absolute",
      top: 0,
      left: 0,
      height: 80,
      zIndex: 3,
      background: "rgba(12,12,16,0.33)",
      borderBottom: "1px solid rgba(255,0,60,0.10)",
      boxShadow: "0 3px 24px 0px rgba(255,0,60,0.06)"
    },
    brand: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 26,
      fontWeight: 900,
      letterSpacing: 2,
      color: "white",
      fontFamily: "'Montserrat',Arial,sans-serif",
      marginLeft: 32
    },
    logo: {
      height: 44,
      width: 44,
      borderRadius: 9,
      boxShadow: "0 0 40px 3px rgba(255,0,60,0.11)"
    },
    card: {
      position: "relative",
      zIndex: 2,
      textAlign: "center",
      padding: "clamp(28px, 6vw, 80px) clamp(16px, 5vw, 55px)",
      borderRadius: 20,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(25,0,0,0.24)",
      boxShadow: "0 0 30px rgba(55,0,0,0.13)",
      width: "min(500px, 92vw)"
    },
    title: {
      fontSize: "clamp(28px, 6vw, 44px)",
      textShadow: "0 0 10px red"
    },
    text: {
      fontSize: "clamp(16px, 3.5vw, 21px)",
      opacity: 0.85
    },
    bgAnim: {
      content: '""',
      position: "absolute",
      width: 400,
      height: 400,
      background: "red",
      filter: "blur(150px)",
      opacity: 0.3,
      top: "20%",
      left: "30%",
      zIndex: 1,
      animation: "floatAnim 6s infinite ease-in-out",
      pointerEvents: "none"
    },
    keyframes: `
      @keyframes floatAnim {
        0% { transform: translate(0,0); }
        50% { transform: translate(100px, -80px); }
        100% { transform: translate(0,0); }
      }
    `
  }

  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = styles.keyframes
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.bgAnim} />
      <div style={styles.topbar}></div>
      <div style={styles.card}>
        <img src={logo} alt="Mollyverse logo" style={styles.logo} />
        <h1 style={styles.title}>Добро пожаловать в Mollyverse!</h1>
        <p style={{ ...styles.text, marginTop: 10 }}>
          Здесь живут добрые посты, теплые истории и немного магии.
        </p>
        <p style={styles.text}>{quote}</p>
      </div>
    </div>
  )
}
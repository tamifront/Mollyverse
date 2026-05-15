import "../styles/Login.css"
import { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
  const [age, setAge] = useState("")

  async function login() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
  
    if (error) {
      alert(error.message)
    } else {
      alert("Вы вошли в Mollyverse 🔥")
      console.log(data)
    }
  }

  async function register() {
    const { error } = await supabase.auth.signUp({
      email,
      password
    })
  
    if (error) {
      alert(error.message)
      return
    }
  
    // сразу логин
    const { data: userData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
  
    if (loginError) {
      alert(loginError.message)
      return
    }
  
    alert("Аккаунт создан и ты вошла 🚀")

    // user id берем из результата логина
    const user = userData && userData.user
    if (!user) {
      alert("Ошибка получения информации о пользователе.")
      return
    }

    await supabase.from("profiles").upsert({
      id: user.id,
      nickname,
      age,
      avatar_url: "" // пустой, так как аватар не загружаем
    })
  
    alert("Аккаунт создан 🚀 теперь войди")
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Добро пожаловать в Mollyverse 🔐</h1>
  
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
  
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          placeholder="nickname"
          onChange={(e) => setNickname(e.target.value)}
        />

        <input
          placeholder="age"
          type="number"
          onChange={(e) => setAge(e.target.value)}
        />

        {/* input для аватара удалён */}
  
        <button onClick={login}>Войти</button>
        <button onClick={register}>Регистрация</button>
      </div>
    </div>
  )
}
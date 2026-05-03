import "../styles/Login.css"
import { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nickname, setNickname] = useState("")
const [age, setAge] = useState("")
const [avatar, setAvatar] = useState(null)

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
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
  
    if (loginError) {
      alert(loginError.message)
      return
    }
  
    alert("Аккаунт создан и ты вошла 🚀")
    let avatarUrl = ""
  
    if (avatar) {
      const fileName = `${user.id}-${avatar.name}`
  
      const { data: uploadData, error: uploadError } =
        await supabase.storage.from("avatars").upload(fileName, avatar)
  
      if (uploadError) {
        alert(uploadError.message)
      } else {
        avatarUrl = uploadData.path
      }
    }
  
    await supabase.from("profiles").upsert({
      id: user.id,
      nickname,
      age,
      avatar_url: avatarUrl
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

<input
  type="file"
  onChange={(e) => setAvatar(e.target.files[0])}
/>
  
        <button onClick={login}>Войти</button>
        <button onClick={register}>Регистрация</button>
      </div>
    </div>
  )
}
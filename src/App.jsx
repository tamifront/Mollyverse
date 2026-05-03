import { useState, useEffect } from "react"
import { supabase } from "./lib/supabase"

import Login from "./pages/Login"
import Home from "./pages/Home"
import Profile from "./pages/Profile"
import Posts from "./pages/Posts"
import SearchPosts from "./pages/SearchPosts"
import Updates from "./pages/Updates"
import EditProfile from "./pages/EditProfile"
import Sidebar from "./components/Sidebar"

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState("home")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
    })

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_, session) => {
        setUser(session?.user || null)
      })

    return () => subscription.unsubscribe()
  }, [])

  if (!user) return <Login />

  return (
    
    <div className="layout">
      <Sidebar setPage={setPage} />

      <div className="page">
        {page === "home" && <Home user={user} />}
        {page === "posts" && <Posts user={user} />}
        {page === "updates" && <Updates user={user} />}
        {page === "search-posts" && <SearchPosts user={user} />}
        {page === "profile" && <Profile user={user} />}
        {page === "editprofile" && <EditProfile user={user} />}
      
      </div>
    </div>
    
  )
}
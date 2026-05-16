import { useState, useEffect, useCallback } from "react"
import { supabase } from "./lib/supabase"
import { hasUnreadUpdates, markUpdatesAsRead } from "./utils/updatesUnread"

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
  const [updatesUnread, setUpdatesUnread] = useState(false)

  const fetchLatestUpdateAt = useCallback(async () => {
    const { data, error } = await supabase
      .from("updates")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) return null
    return data?.[0]?.created_at ?? null
  }, [])

  const refreshUpdatesUnread = useCallback(async () => {
    if (!user?.id) {
      setUpdatesUnread(false)
      return
    }
    const latestAt = await fetchLatestUpdateAt()
    if (!latestAt) {
      setUpdatesUnread(false)
      return
    }
    setUpdatesUnread(hasUnreadUpdates(latestAt, user.id))
  }, [fetchLatestUpdateAt, user?.id])

  const markAllUpdatesRead = useCallback(async () => {
    if (!user?.id) return
    const latestAt = await fetchLatestUpdateAt()
    if (latestAt) markUpdatesAsRead(user.id, latestAt)
    setUpdatesUnread(false)
  }, [fetchLatestUpdateAt, user?.id])

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

  useEffect(() => {
    refreshUpdatesUnread()
    const onRead = () => setUpdatesUnread(false)
    const onPublished = () => refreshUpdatesUnread()
    window.addEventListener("updates-read", onRead)
    window.addEventListener("updates-published", onPublished)
    const interval = setInterval(refreshUpdatesUnread, 45000)
    return () => {
      window.removeEventListener("updates-read", onRead)
      window.removeEventListener("updates-published", onPublished)
      clearInterval(interval)
    }
  }, [refreshUpdatesUnread])

  useEffect(() => {
    if (page !== "updates" || !user?.id) return
    markAllUpdatesRead()
  }, [page, user?.id, markAllUpdatesRead])

  if (!user) return <Login />

  return (
    
    <div className="layout">
      <Sidebar
        setPage={setPage}
        updatesUnread={updatesUnread}
        onOpenUpdates={markAllUpdatesRead}
      />

      <div className="page">
        {page === "home" && <Home user={user} />}
        {page === "posts" && <Posts user={user} />}
        {page === "updates" && (
          <Updates user={user} onUpdatesChange={refreshUpdatesUnread} />
        )}
        {page === "search-posts" && <SearchPosts user={user} />}
        {page === "profile" && <Profile user={user} />}
        {page === "editprofile" && <EditProfile user={user} />}
      
      </div>
    </div>
    
  )
}
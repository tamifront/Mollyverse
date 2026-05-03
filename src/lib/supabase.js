import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://khlzwhcmsicxnlvwdmer.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtobHp3aGNtc2ljeG5sdndkbWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTE2MTIsImV4cCI6MjA5Mjg4NzYxMn0.6fHR4uQMkDWsIh9RiCYS1_rKLfyq4M4bAAcIyLlMqno"

export const supabase = createClient(supabaseUrl, supabaseKey)
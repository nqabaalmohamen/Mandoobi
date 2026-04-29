import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ayxmuvfbhleijlynsdbv.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eG11dmZiaGxlaWpseW5zZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzM0NjAsImV4cCI6MjA4OTE0OTQ2MH0.DH-vS-MdjHvEzI6Os8FygIdL3eQkPSfdHfdprgYfcXY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)



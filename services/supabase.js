import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ayxmuvfbhleijlynsdbv.supabase.co'
const supabaseAnonKey = 'sb_publishable_83xDiBAKDNrlH2rm1wIiSw_qY2-zKKy'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

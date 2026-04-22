import { supabase } from './supabase'

export async function getData(table) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) {
    console.error(`Error fetching ${table}:`, error)
    return []
  }
  return data
}

export async function setData(table, payload) {
  // If payload is an array (like in our old local system), we might need to handle it differently
  // but for Supabase, we usually insert or update rows.
  // This helper is kept for compatibility with existing admin.js calls.
  console.log(`Syncing ${table} to Supabase...`)
  // For 'mandoobi_settings', we use a special table or row
  if (table === 'mandoobi_settings') {
    const { error } = await supabase.from('settings').upsert({ id: 1, ...payload })
    if (error) console.error("Settings sync error:", error)
  }
}

export function subscribeToKey(table, callback) {
  // Initial fetch
  supabase.from(table).select('*').then(({ data }) => {
    if (data) {
      // If it's settings, return the first row as an object
      if (table === 'settings' || table === 'mandoobi_settings') {
        callback(data[0] || {})
      } else {
        callback(data)
      }
    }
  })

  // Realtime
  const sub = supabase
    .channel(`${table}_sync`)
    .on('postgres_changes', { event: '*', table: table }, () => {
      supabase.from(table).select('*').then(({ data }) => {
        if (data) {
          if (table === 'settings' || table === 'mandoobi_settings') {
            callback(data[0] || {})
          } else {
            callback(data)
          }
        }
      })
    })
    .subscribe()

  return () => supabase.removeChannel(sub)
}

import { supabase } from './supabase'

const tableMap = {
  'mandoobi_users': 'profiles',
  'mandoobi_orders': 'orders',
  'mandoobi_couriers': 'couriers',
  'mandoobi_settings': 'settings',
  'mandoobi_support_requests': 'support_requests'
}

export async function getData(table) {
  const dbTable = tableMap[table] || table
  const { data, error } = await supabase.from(dbTable).select('*')
  if (error) {
    console.error(`Error fetching ${dbTable}:`, error)
    return []
  }
  return data
}


export async function setData(table, payload) {
  console.log(`Syncing ${table} to Supabase...`)
  
  // For 'mandoobi_settings', we use a special row
  if (table === 'mandoobi_settings' || table === 'settings') {
    const { error } = await supabase.from('settings').upsert({ id: 1, ...payload })
    if (error) console.error("Settings sync error:", error)
    return
  }

  // If payload is an array (legacy logic), we might need to sync row by row or handle differently.
  // However, most modern calls should pass individual objects or we should handle table sync.
  // For simplicity in this migration, we'll log it.
  console.warn(`Direct array sync for ${table} is not fully supported via setData. Individual table services should be used.`)
}

export function subscribeToData(table, callback) {
  // Map internal storage keys to Supabase table names if necessary
  const tableMap = {
    'mandoobi_users': 'profiles',
    'mandoobi_orders': 'orders',
    'mandoobi_couriers': 'couriers',
    'mandoobi_settings': 'settings',
    'mandoobi_support_requests': 'support_requests'
  }

  const dbTable = tableMap[table] || table

  // Initial fetch
  supabase.from(dbTable).select('*').then(({ data }) => {
    if (data) {
      if (dbTable === 'settings') {
        callback(data[0] || {})
      } else {
        callback(data)
      }
    }
  })

  // Realtime
  const sub = supabase
    .channel(`${dbTable}_sync`)
    .on('postgres_changes', { event: '*', table: dbTable }, () => {
      supabase.from(dbTable).select('*').then(({ data }) => {
        if (data) {
          if (dbTable === 'settings') {
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

export function subscribeToKey(table, callback) {
  return subscribeToData(table, callback)
}


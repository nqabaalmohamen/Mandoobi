import { supabase } from './supabase'

export async function createOrder(payload) {
  const { data, error } = await supabase
    .from('orders')
    .insert([{
      ...payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }])
    .select()

  if (error) throw error
  return data[0].id
}

export function subscribeToOrders(callback) {
  // Initial fetch
  supabase.from('orders').select('*').order('createdAt', { ascending: false }).then(({ data }) => {
    if (data) callback(data)
  })

  // Realtime subscription
  const sub = supabase
    .channel('orders_changes')
    .on('postgres_changes', { event: '*', table: 'orders' }, () => {
      supabase.from('orders').select('*').order('createdAt', { ascending: false }).then(({ data }) => {
        if (data) callback(data)
      })
    })
    .subscribe()

  return () => supabase.removeChannel(sub)
}

export function subscribeToOrder(id, callback) {
  supabase.from('orders').select('*').eq('id', id).single().then(({ data }) => {
    if (data) callback(data)
  })

  const sub = supabase
    .channel(`order_${id}`)
    .on('postgres_changes', { event: 'UPDATE', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
      callback(payload.new)
    })
    .subscribe()

  return () => supabase.removeChannel(sub)
}

export async function getOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateOrderStatus(id, status, courierId = null, extraData = {}) {
  const timeData = {}
  if (status === 'accepted') timeData.acceptedAt = new Date().toISOString()
  if (status === 'on_way') timeData.pickedUpAt = new Date().toISOString()
  if (status === 'completed') timeData.completedAt = new Date().toISOString()

  const { error } = await supabase
    .from('orders')
    .update({
      status,
      ...(courierId ? { courierId } : {}),
      updatedAt: new Date().toISOString(),
      ...timeData,
      ...extraData
    })
    .eq('id', id)

  if (error) throw error
}

export async function updateOrder(id, payload) {
  const { error } = await supabase
    .from('orders')
    .update({ ...payload, updatedAt: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function deleteOrder(id) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)

  if (error) throw error
}

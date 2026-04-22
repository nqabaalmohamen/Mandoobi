import { getData, setData, subscribeToKey } from './db'

export async function createOrder(payload) {
  const orders = getData('mandoobi_orders')
  const id = `order_${Date.now()}`
  const newOrder = {
    ...payload,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  orders.unshift(newOrder)
  setData('mandoobi_orders', orders)
  return id
}

export function subscribeToOrders(callback) {
  return subscribeToKey('mandoobi_orders', callback)
}

export function subscribeToOrder(id, callback) {
  const handler = (orders) => {
    const order = orders.find(o => o.id === id)
    if (order) callback(order)
  }
  return subscribeToKey('mandoobi_orders', handler)
}

export async function getOrder(id) {
  const orders = getData('mandoobi_orders')
  const order = orders.find(o => o.id === id)
  if (!order) throw new Error('الطلب غير موجود')
  return order
}

export async function updateOrderStatus(id, status, courierId = null, extraData = {}) {
  const orders = getData('mandoobi_orders')
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('الطلب غير موجود')

  const timeData = {}
  if (status === 'accepted') timeData.acceptedAt = new Date().toISOString()
  if (status === 'on_way') timeData.pickedUpAt = new Date().toISOString()
  if (status === 'completed') timeData.completedAt = new Date().toISOString()

  orders[idx] = {
    ...orders[idx],
    status,
    ...(courierId ? { courierId } : {}),
    updatedAt: new Date().toISOString(),
    ...timeData,
    ...extraData
  }
  setData('mandoobi_orders', orders)
}

export async function updateOrder(id, payload) {
  const orders = getData('mandoobi_orders')
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('الطلب غير موجود')
  orders[idx] = { ...orders[idx], ...payload, updatedAt: new Date().toISOString() }
  setData('mandoobi_orders', orders)
}

export async function deleteOrder(id) {
  const orders = getData('mandoobi_orders')
  setData('mandoobi_orders', orders.filter(o => o.id !== id))
}

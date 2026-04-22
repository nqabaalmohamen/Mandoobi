import { collection, addDoc, doc, getDoc, query, where, getDocs, serverTimestamp, onSnapshot, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

// Helper for cross-device real-time (demo mode)
const notifyStorageChange = async (key, value) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mandoobi_data_changed'))
    // Save to server API for cross-device sync
    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
    } catch (e) {
      console.error('Failed to sync with server:', e)
    }
  }
}

export async function createOrder(payload){
  if(!db){
    // demo mode: fetch latest from server first to ensure sequential IDs
    const res = await fetch('/api/storage?key=mandoobi_orders')
    const orders = await res.json()
    
    const maxId = orders.reduce((max, o) => {
      const numId = parseInt(o.id);
      return isNaN(numId) ? max : Math.max(max, numId);
    }, 0);
    const newId = (maxId + 1).toString();
    
    const doc = { id: newId, ...payload, createdAt: new Date().toISOString() }
    orders.push(doc)
    
    await notifyStorageChange('mandoobi_orders', orders)
    return newId
  }
  const docRef = await addDoc(collection(db,'orders'),{...payload, createdAt: serverTimestamp()})
  return docRef.id
}

export function subscribeToOrders(callback) {
  if (!db) {
    let lastData = ''
    const handler = async () => {
      try {
        const res = await fetch('/api/storage?key=mandoobi_orders')
        const orders = await res.json()
        const stringified = JSON.stringify(orders)
        if (stringified !== lastData) {
          lastData = stringified
          callback(orders)
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }
    
    // Initial call
    handler()
    
    // Poll every 2 seconds for cross-device real-time
    const interval = setInterval(handler, 2000)
    
    window.addEventListener('mandoobi_data_changed', handler)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('mandoobi_data_changed', handler)
    }
  }

  const q = query(collection(db, 'orders'))
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(orders)
  })
}

export function subscribeToOrder(id, callback) {
  if (!db) {
    const handler = async () => {
      const res = await fetch('/api/storage?key=mandoobi_orders')
      const orders = await res.json()
      const o = orders.find(x => x.id === id)
      callback(o)
    }
    const interval = setInterval(handler, 2000)
    window.addEventListener('mandoobi_data_changed', handler)
    handler()
    return () => {
      clearInterval(interval)
      window.removeEventListener('mandoobi_data_changed', handler)
    }
  }

  const ref = doc(db, 'orders', id)
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

export async function getOrder(id){
  if(!db){
    const res = await fetch('/api/storage?key=mandoobi_orders')
    const orders = await res.json()
    const o = orders.find(x=> x.id === id)
    if(!o) throw new Error('Order not found (demo)')
    return o
  }
  const snap = await getDoc(doc(db,'orders',id))
  if(!snap.exists()) throw new Error('Order not found')
  return { id: snap.id, ...snap.data() }
}

export async function updateOrderStatus(id, status, courierId=null, extraData={}){
  const now = new Date().toISOString();
  const timeData = {};
  
  if (status === 'accepted') timeData.acceptedAt = now;
  if (status === 'on_way') timeData.pickedUpAt = now;
  if (status === 'completed') timeData.completedAt = now;

  if(!db){
    const res = await fetch('/api/storage?key=mandoobi_orders')
    const orders = await res.json()
    const updated = orders.map(o=> o.id === id ? {
      ...o, 
      status, 
      courierId: courierId || o.courierId, 
      updatedAt: now,
      ...timeData,
      ...extraData
    } : o)
    await notifyStorageChange('mandoobi_orders', updated)
    return
  }
  const ref = doc(db,'orders',id)
  await setDoc(ref,{ status, courierId, updatedAt: serverTimestamp(), ...timeData, ...extraData },{ merge: true })
}

export async function updateOrder(id, payload){
  if(!db){
    const res = await fetch('/api/storage?key=mandoobi_orders')
    const orders = await res.json()
    const updated = orders.map(o=> o.id === id ? {
      ...o, 
      ...payload, 
      updatedAt: new Date().toISOString()
    } : o)
    await notifyStorageChange('mandoobi_orders', updated)
    return
  }
  const ref = doc(db,'orders',id)
  await setDoc(ref,{ ...payload, updatedAt: serverTimestamp() },{ merge: true })
}

export async function deleteOrder(id){
  if(!db){
    const res = await fetch('/api/storage?key=mandoobi_orders')
    const orders = await res.json()
    const updated = orders.filter(o => o.id !== id)
    await notifyStorageChange('mandoobi_orders', updated)
    return
  }
  await deleteDoc(doc(db, 'orders', id))
}

export function listPendingOrders(){
  if(!db) return JSON.parse(localStorage.getItem('mandoobi_orders')||'[]').filter(o=> o.status === 'pending')
  // Firestore path omitted for brevity
  return []
}

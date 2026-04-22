import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  onSnapshot 
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * Universal storage replacement using Firestore.
 * Maps the old 'key' system to Firestore collections.
 */

const COLLECTION_MAP = {
  'mandoobi_orders': 'orders',
  'mandoobi_users': 'users',
  'mandoobi_couriers': 'couriers',
  'mandoobi_settings': 'settings',
  'mandoobi_support_requests': 'support'
}

export async function getData(key) {
  if (!db) return []
  const colName = COLLECTION_MAP[key] || key
  
  // Special case for settings (usually a single doc)
  if (key === 'mandoobi_settings') {
    const snap = await getDoc(doc(db, 'config', 'settings'))
    return snap.exists() ? snap.data() : {
      commission: 15, 
      commissionType: 'percentage', 
      baseFare: 35, // Updated to 35 as per previous requirements
      maintenanceMode: false
    }
  }

  const q = query(collection(db, colName))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function setData(key, value) {
  if (!db) return
  const colName = COLLECTION_MAP[key] || key

  // Special case for settings
  if (key === 'mandoobi_settings') {
    await setDoc(doc(db, 'config', 'settings'), value, { merge: true })
    window.dispatchEvent(new Event('mandoobi_data_changed'))
    return
  }

  // If value is an array (old system), we need to handle it carefully.
  // In a real app, we'd update individual docs. 
  // For the fastest "immediate" fix, we'll map array elements to docs by ID.
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = item.id || item.uid || item.phone || Date.now().toString()
      await setDoc(doc(db, colName, id), item, { merge: true })
    }
  } else {
    const id = value.id || value.uid || Date.now().toString()
    await setDoc(doc(db, colName, id), value, { merge: true })
  }
  
  window.dispatchEvent(new Event('mandoobi_data_changed'))
}

// Global settings listener for maintenance mode
export function subscribeToSettings(callback) {
  if (!db) return () => {}
  return onSnapshot(doc(db, 'config', 'settings'), (snap) => {
    callback(snap.exists() ? snap.data() : {})
  })
}

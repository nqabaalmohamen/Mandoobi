import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc,
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  onSnapshot, 
  deleteDoc,
  orderBy
} from 'firebase/firestore'
import { db } from './firebase'

export async function createOrder(payload){
  const docRef = await addDoc(collection(db, 'orders'), {
    ...payload, 
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export function subscribeToOrders(callback) {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map(d => ({ 
      id: d.id, 
      ...d.data(),
      // Handle timestamp conversion if needed for local UI
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().createdAt
    }))
    callback(orders)
  })
}

export function subscribeToOrder(id, callback) {
  const ref = doc(db, 'orders', id)
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ 
        id: snap.id, 
        ...snap.data(),
        createdAt: snap.data().createdAt?.toDate?.()?.toISOString() || snap.data().createdAt
      })
    }
  })
}

export async function getOrder(id){
  const snap = await getDoc(doc(db, 'orders', id))
  if(!snap.exists()) throw new Error('Order not found')
  return { 
    id: snap.id, 
    ...snap.data(),
    createdAt: snap.data().createdAt?.toDate?.()?.toISOString() || snap.data().createdAt
  }
}

export async function updateOrderStatus(id, status, courierId=null, extraData={}){
  const timeData = {};
  if (status === 'accepted') timeData.acceptedAt = new Date().toISOString();
  if (status === 'on_way') timeData.pickedUpAt = new Date().toISOString();
  if (status === 'completed') timeData.completedAt = new Date().toISOString();

  const ref = doc(db, 'orders', id)
  await setDoc(ref, { 
    status, 
    courierId: courierId || undefined, 
    updatedAt: serverTimestamp(), 
    ...timeData, 
    ...extraData 
  }, { merge: true })
}

export async function updateOrder(id, payload){
  const ref = doc(db, 'orders', id)
  await setDoc(ref, { 
    ...payload, 
    updatedAt: serverTimestamp() 
  }, { merge: true })
}

export async function deleteOrder(id){
  await deleteDoc(doc(db, 'orders', id))
}


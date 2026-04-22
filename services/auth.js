import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'

const AuthContext = createContext()

// Helper for local real-time (demo mode)
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

export function AuthProvider({ children }){
  const authHook = useProvideAuth()
  return <AuthContext.Provider value={authHook}>{children}</AuthContext.Provider>
}

export const useAuth = ()=> useContext(AuthContext)

function useProvideAuth(){
  const [user, setUser] = useState(undefined) // undefined means loading, null means not logged in

  useEffect(()=>{
    if(!auth){
      // Initialize demo admin if not exists OR update it to ensure admin/admin works
      const syncAdmin = async () => {
        try {
          const res = await fetch('/api/storage?key=mandoobi_users')
          const users = await res.json()
          const adminIndex = users.findIndex(u => u.role === 'admin' || u.phone === 'admin')
          
          const adminUser = { 
            id: 'admin_123', 
            name: 'مدير الموقع', 
            phone: 'admin', 
            password: 'admin', 
            role: 'admin' 
          }

          if(adminIndex === -1) {
            users.push(adminUser)
            await notifyStorageChange('mandoobi_users', users)
          } else {
            // Ensure the existing admin has correct credentials
            const updatedAdmin = { ...users[adminIndex], phone: 'admin', password: 'admin', role: 'admin' }
            if (JSON.stringify(users[adminIndex]) !== JSON.stringify(updatedAdmin)) {
              users[adminIndex] = updatedAdmin
              await notifyStorageChange('mandoobi_users', users)
            }
          }
        } catch (e) {
          console.error('Failed to sync admin:', e)
        }
      }
      
      syncAdmin()

      // Live listener for user state in local mode
      const handler = async () => {
        const stored = localStorage.getItem('mandoobi_user')
        if(stored) {
          const userObj = JSON.parse(stored)
          try {
            // Also sync with latest data from users list if it exists on server
            const res = await fetch('/api/storage?key=mandoobi_users')
            const users = await res.json()
            const fresh = users.find(u => u.id === userObj.uid)
            if(fresh) {
              const updated = { ...userObj, ...fresh }
              setUser(updated)
            } else {
              setUser(userObj)
            }
          } catch (e) {
            setUser(userObj)
          }
        }
      }

      // Polling for user data updates (e.g. status changes by admin)
      const interval = setInterval(handler, 2000)
      window.addEventListener('mandoobi_data_changed', handler)
      window.addEventListener('storage', handler)
      handler()
      return () => {
        clearInterval(interval)
        window.removeEventListener('mandoobi_data_changed', handler)
        window.removeEventListener('storage', handler)
      }
    }
    const unsub = onAuthStateChanged(auth, async (u)=>{
      if(u){
        if(db){
          const snap = await getDoc(doc(db,'users',u.uid))
          setUser({ uid: u.uid, ...(snap.exists()? snap.data(): {}) })
        }else{
          setUser({ uid: u.uid })
        }
      }else{
        setUser(null)
      }
    })
    return ()=>unsub()
  },[])

  const signIn = async (phone, password)=>{
    const cleanPhone = phone?.trim()
    const cleanPassword = password?.trim()

    if(!auth){
      // demo local sign in - fetch from server
      const res = await fetch('/api/storage?key=mandoobi_users')
      const users = await res.json()
      const u = users.find(x=> x.phone === cleanPhone && x.password === cleanPassword)
      
      if(!u) {
        // Check if user exists but password is wrong
        const userExists = users.some(x => x.phone === cleanPhone)
        if(userExists) {
          throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة')
        } else {
          throw new Error('عذراً، هذا الحساب غير موجود. يرجى التأكد من البيانات أو إنشاء حساب جديد.')
        }
      }

      // get courier status if courier
      let role = u.role || 'client'
      let courierStatus = u.courierStatus || null 
      
      if(role === 'courier' && !courierStatus){
        const cRes = await fetch('/api/storage?key=mandoobi_couriers')
        const couriers = await cRes.json()
        const c = couriers.find(k=> k.userId === u.id)
        courierStatus = c? c.status : 'pending'
      }
      
      const payload = { 
        uid: u.id, 
        name: u.name, 
        phone: u.phone, 
        role, 
        courierStatus,
        courierStatusReason: u.courierStatusReason || ''
      }
      localStorage.setItem('mandoobi_user', JSON.stringify(payload))
      setUser(payload)
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      return
    }
    // For demo, we use email as phone@example.com and Firebase Email auth
    const email = `${cleanPhone}@mandoobi.local`
    await signInWithEmailAndPassword(auth, email, cleanPassword)
  }

  const signUp = async ({name, phone, address, password, role='client', courierData})=>{
    // role: 'client' | 'courier'
    if(!auth || !db){
      try {
        // demo local signup - fetch/update server
        const res = await fetch('/api/storage?key=mandoobi_users')
        const users = await res.json()
        
        // Check if phone number already exists
        const phoneExists = users.some(u => u.phone === phone)
        if (phoneExists) {
          throw new Error('رقم الهاتف مسجل بالفعل، يرجى استخدام رقم آخر')
        }
        
        const id = `local_${Date.now()}`
        const newUser = { id, name, phone, address, password, role }
        users.push(newUser)
        await notifyStorageChange('mandoobi_users', users)

        // if courier, store extra courier info and mark pending
        if(role === 'courier' && courierData){
          const cRes = await fetch('/api/storage?key=mandoobi_couriers')
          const couriers = await cRes.json()
          couriers.push({ userId: id, ...courierData, status: 'pending' })
          await notifyStorageChange('mandoobi_couriers', couriers)
        }

        const payload = { uid: id, name, phone, address, role }
        localStorage.setItem('mandoobi_user', JSON.stringify(payload))
        setUser(payload)
        window.dispatchEvent(new Event('mandoobi_data_changed'))
      } catch (e) {
        throw e
      }
      return
    }
    const email = `${phone}@mandoobi.local`
    const res = await createUserWithEmailAndPassword(auth, email, password)
    // create user doc
    await setDoc(doc(db,'users',res.user.uid),{
      name, phone, address, role, createdAt: serverTimestamp()
    })
    if(role === 'courier' && courierData){
      await setDoc(doc(db,'couriers',res.user.uid),{ userId: res.user.uid, ...courierData, status: 'pending' })
    }
  }

  const signOutUser = async ()=>{
    if(!auth){
      localStorage.removeItem('mandoobi_user')
      setUser(null)
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      return
    }
    await signOut(auth)
  }

  const guestLogin = (guestName='زائر', guestPhone='')=>{
    // Set a lightweight guest identity so UI can show guest mode
    const id = `guest_${Date.now()}`
    const payload = { uid: id, name: guestName, phone: guestPhone, role: 'guest' }
    localStorage.setItem('mandoobi_user', JSON.stringify(payload))
    setUser(payload)
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }

  const requestPasswordReset = async (phone) => {
    const res = await fetch('/api/storage?key=mandoobi_password_requests')
    const requests = await res.json()
    
    // Check if there is already a pending request for this phone
    if (requests.some(r => r.phone === phone && r.status === 'pending')) {
      return // Already requested
    }

    const newRequest = {
      id: `req_${Date.now()}`,
      phone,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    
    requests.push(newRequest)
    await notifyStorageChange('mandoobi_password_requests', requests)
  }

  const changePassword = async (userId, newPassword) => {
    const res = await fetch('/api/storage?key=mandoobi_users')
    const users = await res.json()
    const index = users.findIndex(u => u.id === userId)
    if (index !== -1) {
      users[index].password = newPassword
      await notifyStorageChange('mandoobi_users', users)
      return true
    }
    return false
  }

  return { user, signIn, signUp, signOut: signOutUser, guestLogin, requestPasswordReset, changePassword }
}

// Add global listener helper for dashboards
export function subscribeToData(key, callback) {
  if (!auth) {
    let lastData = ''
    const handler = async () => {
      try {
        const res = await fetch(`/api/storage?key=${key}`)
        const data = await res.json()
        const stringified = JSON.stringify(data)
        if (stringified !== lastData) {
          lastData = stringified
          callback(data)
        }
      } catch (e) {
        console.error(`Polling error for ${key}:`, e)
      }
    }
    
    // Initial call
    handler()
    
    // Poll every 2 seconds for cross-device real-time
    const interval = setInterval(handler, 2000)
    
    window.addEventListener('mandoobi_data_changed', handler)
    window.addEventListener('storage', handler)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('mandoobi_data_changed', handler)
      window.removeEventListener('storage', handler)
    }
  }

  // Firebase fallback (omitted for now as we focus on local dev)
  return () => {}
}

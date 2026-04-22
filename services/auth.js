import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from './firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { getData, setData } from './db'

const AuthContext = createContext()

export function AuthProvider({ children }){
  const authHook = useProvideAuth()
  return <AuthContext.Provider value={authHook}>{children}</AuthContext.Provider>
}

export const useAuth = ()=> useContext(AuthContext)

function useProvideAuth(){
  const [user, setUser] = useState(undefined)

  useEffect(()=>{
    if (!auth) {
      // Demo Mode Listener
      const handler = () => {
        const stored = localStorage.getItem('mandoobi_user')
        setUser(stored ? JSON.parse(stored) : null)
      }
      handler()
      window.addEventListener('mandoobi_data_changed', handler)
      return () => window.removeEventListener('mandoobi_data_changed', handler)
    }

    const unsub = onAuthStateChanged(auth, async (u)=>{
      if(u){
        if(db){
          const snap = await getDoc(doc(db,'users',u.uid))
          const userData = snap.exists() ? snap.data() : {}
          
          // Special case for admin (checking if UID is admin or has admin role)
          const isAdmin = userData.role === 'admin'
          
          setUser({ 
            uid: u.uid, 
            ...userData,
            isAdmin
          })
        } else {
          setUser({ uid: u.uid })
        }
      } else {
        setUser(null)
      }
    })
    return ()=> unsub()
  }, [])

  const signIn = async (phone, password)=>{
    const cleanPhone = phone?.trim()
    const cleanPassword = password?.trim()

    if (!auth) {
      // Demo Mode SignIn
      const users = await getData('mandoobi_users')
      const u = users.find(x => x.phone === cleanPhone && x.password === cleanPassword)
      
      if (!u && cleanPhone === 'admin' && cleanPassword === 'admin') {
        const adminUser = { uid: 'admin_123', name: 'مدير الموقع', phone: 'admin', role: 'admin', isAdmin: true }
        localStorage.setItem('mandoobi_user', JSON.stringify(adminUser))
        setUser(adminUser)
        return
      }

      if (!u) throw new Error('بيانات الدخول غير صحيحة (وضع التجربة)')
      
      const payload = { uid: u.id, ...u }
      localStorage.setItem('mandoobi_user', JSON.stringify(payload))
      setUser(payload)
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      return
    }

    // Map phone to email for Firebase Auth
    const email = cleanPhone === 'admin' ? 'admin@mandoobi.local' : `${cleanPhone}@mandoobi.local`
    await signInWithEmailAndPassword(auth, email, cleanPassword)
  }

  const signUp = async ({name, phone, address, password, role='client', courierData})=>{
    if (!auth) {
      // Demo Mode SignUp
      const users = await getData('mandoobi_users')
      const id = `local_${Date.now()}`
      const newUser = { id, name, phone, address, password, role }
      users.push(newUser)
      await setData('mandoobi_users', users)

      if(role === 'courier' && courierData){
        const couriers = await getData('mandoobi_couriers')
        couriers.push({ userId: id, ...courierData, status: 'pending' })
        await setData('mandoobi_couriers', couriers)
      }

      const payload = { uid: id, name, phone, address, role }
      localStorage.setItem('mandoobi_user', JSON.stringify(payload))
      setUser(payload)
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      return
    }

    const email = `${phone}@mandoobi.local`
    const res = await createUserWithEmailAndPassword(auth, email, password)
    
    const userData = {
      name, 
      phone, 
      address, 
      role, 
      createdAt: serverTimestamp()
    }

    await setDoc(doc(db,'users',res.user.uid), userData)
    
    if(role === 'courier' && courierData){
      await setDoc(doc(db,'couriers',res.user.uid), { 
        userId: res.user.uid, 
        ...courierData, 
        status: 'pending' 
      })
    }
  }

  const signOutUser = async ()=>{
    if (!auth) {
      localStorage.removeItem('mandoobi_user')
      setUser(null)
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      return
    }
    await signOut(auth)
  }

  const guestLogin = (guestName='زائر', guestPhone='')=>{
    const id = `guest_${Date.now()}`
    const payload = { uid: id, name: guestName, phone: guestPhone, role: 'guest' }
    localStorage.setItem('mandoobi_user', JSON.stringify(payload))
    setUser(payload)
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }

  const changePassword = async (userId, newPassword) => {
    // Note: In Firebase, changing password requires re-authentication or admin SDK.
    // For this demo, we'll just update the password field in Firestore users doc if it exists,
    // though this won't change the actual Auth password.
    await setDoc(doc(db, 'users', userId), { password: newPassword }, { merge: true })
    return true
  }

  return { user, signIn, signUp, signOut: signOutUser, guestLogin, changePassword }
}

export function subscribeToData(collectionName, callback) {
  if (!db) return () => {}
  const q = collection(db, collectionName)
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(data)
  })
}


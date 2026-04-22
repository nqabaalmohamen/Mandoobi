import { createContext, useContext, useEffect, useState } from 'react'
import { getData, setData, subscribeToKey } from './db'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const authHook = useProvideAuth()
  return <AuthContext.Provider value={authHook}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

function useProvideAuth() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    // Load user from localStorage on mount
    const stored = localStorage.getItem('mandoobi_user')
    setUser(stored ? JSON.parse(stored) : null)

    const handler = () => {
      const updated = localStorage.getItem('mandoobi_user')
      setUser(updated ? JSON.parse(updated) : null)
    }
    window.addEventListener('mandoobi_data_changed', handler)
    return () => window.removeEventListener('mandoobi_data_changed', handler)
  }, [])

  const signIn = async (phone, password) => {
    const cleanPhone = phone?.trim()
    const cleanPassword = password?.trim()

    // Admin login
    if (cleanPhone === 'admin' && cleanPassword === 'admin') {
      const adminUser = {
        uid: 'admin_123',
        id: 'admin_123',
        name: 'مدير الموقع',
        phone: 'admin',
        role: 'admin',
        isAdmin: true
      }
      localStorage.setItem('mandoobi_user', JSON.stringify(adminUser))
      setUser(adminUser)
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      return
    }

    // Regular user login
    const users = getData('mandoobi_users')
    const u = users.find(x => x.phone === cleanPhone && x.password === cleanPassword)
    if (!u) throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة')

    const payload = { uid: u.id, ...u }
    localStorage.setItem('mandoobi_user', JSON.stringify(payload))
    setUser(payload)
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }

  const signUp = async ({ name, phone, address, password, role = 'client', courierData }) => {
    const users = getData('mandoobi_users')

    // Check for duplicate phone
    if (users.find(u => u.phone === phone)) {
      throw new Error('رقم الهاتف مسجل مسبقاً')
    }

    const id = `user_${Date.now()}`
    const newUser = { id, name, phone, address, password, role, createdAt: new Date().toISOString() }
    users.push(newUser)
    setData('mandoobi_users', users)

    if (role === 'courier' && courierData) {
      const couriers = getData('mandoobi_couriers')
      couriers.push({ id: `courier_${Date.now()}`, userId: id, name, phone, ...courierData, status: 'pending', createdAt: new Date().toISOString() })
      setData('mandoobi_couriers', couriers)
    }

    const payload = { uid: id, id, name, phone, address, role }
    localStorage.setItem('mandoobi_user', JSON.stringify(payload))
    setUser(payload)
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }

  const signOutUser = () => {
    localStorage.removeItem('mandoobi_user')
    setUser(null)
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }

  const guestLogin = (guestName = 'زائر', guestPhone = '') => {
    const id = `guest_${Date.now()}`
    const payload = { uid: id, id, name: guestName, phone: guestPhone, role: 'guest' }
    localStorage.setItem('mandoobi_user', JSON.stringify(payload))
    setUser(payload)
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }

  const changePassword = async (userId, newPassword) => {
    const users = getData('mandoobi_users')
    const idx = users.findIndex(u => u.id === userId || u.uid === userId)
    if (idx !== -1) {
      users[idx].password = newPassword
      setData('mandoobi_users', users)
    }
    return true
  }

  return { user, signIn, signUp, signOut: signOutUser, guestLogin, changePassword }
}

// Subscribe to any localStorage key with live updates
export function subscribeToData(key, callback) {
  return subscribeToKey(key, callback)
}

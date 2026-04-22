import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const authHook = useProvideAuth()
  return <AuthContext.Provider value={authHook}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

function useProvideAuth() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        setUser({ uid: session.user.id, id: session.user.id, ...profile })
      } else {
        setUser(null)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setUser({ uid: session.user.id, id: session.user.id, ...profile })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (phone, password) => {
    const cleanPhone = phone?.trim()
    const cleanPassword = password?.trim()

    // Handle dummy email for phone-based login in Supabase
    const email = cleanPhone === 'admin' ? 'admin@mandoobi.local' : `${cleanPhone}@mandoobi.local`
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: cleanPassword,
    })

    if (error) throw error
    return data
  }

  const signUp = async ({ name, phone, address, password, role = 'client', courierData }) => {
    const email = `${phone}@mandoobi.local`
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role }
      }
    })

    if (error) throw error

    // Profile is created via Trigger in Supabase or manually here
    // For simplicity, we do it manually here if the trigger isn't set up
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        { id: data.user.id, name, phone, address, role, createdAt: new Date().toISOString() }
      ])
    
    if (profileError) console.error("Profile insert error:", profileError)

    if (role === 'courier' && courierData) {
      await supabase
        .from('couriers')
        .insert([
          { userId: data.user.id, ...courierData, status: 'pending' }
        ])
    }

    return data
  }

  const signOutUser = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const changePassword = async (userId, newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return true
  }

  return { user, signIn, signUp, signOut: signOutUser, changePassword }
}

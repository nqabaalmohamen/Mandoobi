import { useEffect, useState } from 'react'
import { useAuth } from '../../services/auth'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

const STORAGE_KEY = 'mandoobi_users'
const PERMISSIONS = [
  { id: 'orders', label: 'إدارة الطلبات' },
  { id: 'users', label: 'إدارة المستخدمين' },
  { id: 'couriers', label: 'إدارة المناديب' },
  { id: 'support', label: 'الدعم الفني' },
  { id: 'settings', label: 'الإعدادات' },
  { id: 'passwords', label: 'طلبات كلمات المرور' }
]

const syncToServer = async (key, value) => {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  } catch (e) {
    console.error('Failed to sync:', e)
  }
}

export default function AdminProfile() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState({ name: '', phone: '', permissions: [] })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })

  const isMainAdmin = user?.phone === 'admin' || user?.id === 'admin_123'

  useEffect(() => {
    if (!user) return
    setProfile({
      name: user.name || '',
      phone: user.phone || '',
      permissions: user.permissions || []
    })
  }, [user])

  const handleUpdateProfile = async () => {
    if (editData.phone && /^\d+$/.test(editData.phone) && (editData.phone.length !== 11 || !editData.phone.startsWith('01'))) {
      alert('يجب أن يبدأ رقم الهاتف بـ 01 ويتكون من 11 رقم بالضبط')
      return
    }
    if (!profile.name || !profile.phone) {
      setMsg({ text: 'يرجى ملء جميع الحقول المطلوبة', type: 'error' })
      return
    }

    try {
      const res = await fetch('/api/storage?key=' + STORAGE_KEY)
      const users = await res.json()
      const index = users.findIndex(u => u.id === user.uid || u.id === user.id)

      if (index !== -1) {
        users[index] = { ...users[index], name: profile.name, phone: profile.phone, permissions: profile.permissions }
        await syncToServer(STORAGE_KEY, users)
        localStorage.setItem('mandoobi_user', JSON.stringify(users[index]))
        setMsg({ text: 'تم تحديث الملف الشخصي بنجاح ✅', type: 'success' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      }
    } catch (err) {
      setMsg({ text: 'فشل في تحديث الملف الشخصي', type: 'error' })
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMsg({ text: 'يرجى إدخال كلمة المرور الجديدة وتأكيدها', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: 'كلمتا المرور غير متطابقتين', type: 'error' })
      return
    }
    if (newPassword.length < 6) {
      setMsg({ text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', type: 'error' })
      return
    }

    try {
      const res = await fetch('/api/storage?key=' + STORAGE_KEY)
      const users = await res.json()
      const index = users.findIndex(u => u.id === user.uid || u.id === user.id)

      if (index !== -1) {
        users[index].password = newPassword
        await syncToServer(STORAGE_KEY, users)
        setNewPassword('')
        setConfirmPassword('')
        setMsg({ text: 'تم تغيير كلمة المرور بنجاح ✅', type: 'success' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      }
    } catch (err) {
      setMsg({ text: 'فشل في تغيير كلمة المرور', type: 'error' })
    }
  }

  useEffect(() => {
    if (user === null) {
      router.push('/')
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center p-10 bg-white rounded-3xl shadow-xl border border-slate-100">
          <div className="text-7xl mb-6">🔒</div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">يرجى تسجيل الدخول أولاً</h2>
          <button onClick={() => router.push('/')} className="px-10 py-4 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 transition-all shadow-lg inline-block">العودة للرئيسية</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Head>
        <title>الملف الشخصي | Mandoobi</title>
      </Head>

      <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-slate-100 rounded-xl transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-slate-800">الملف الشخصي 👤</h1>
          </div>
          <Link href="/dashboard/admin" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition text-sm">
            ← العودة للوحة التحكم
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {msg.text && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            <span>{msg.type === 'success' ? '✅' : '⚠️'}</span>
            {msg.text}
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-l from-purple-600 to-purple-700 p-8 text-white">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center text-4xl font-black">
                {user?.name?.charAt(0) || 'م'}
              </div>
              <div>
                <h2 className="text-3xl font-black">{user?.name}</h2>
                <p className="text-purple-100 mt-1">{isMainAdmin ? 'مدير الموقع الرئيسي' : 'مسؤول'}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full">{user?.phone}</span>
                  {isMainAdmin && (
                    <span className="bg-yellow-400/30 text-yellow-200 px-3 py-1 rounded-full">صلاحيات كاملة</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">تعديل البيانات الشخصية</h3>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">الاسم</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">رقم الهاتف</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  className={`w-full px-4 py-3 bg-slate-50 rounded-xl border ${profile.phone && (profile.phone.length !== 11 || !profile.phone.startsWith('01')) ? 'border-red-300' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500 focus:bg-white transition`}
                />
                {profile.phone && /^\d+$/.test(profile.phone) && (profile.phone.length !== 11 || !profile.phone.startsWith('01')) && (
                  <div className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50 animate-fade-in w-fit">
                    <span className="text-[10px]">⚠️</span>
                    <p className="text-[10px] font-black">يجب البدء بـ 01 و11 رقم (حالياً: {profile.phone.length})</p>
                  </div>
                )}
              </div>
            </div>

            {!isMainAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-3">الصلاحيات</label>
                <div className="grid grid-cols-2 gap-3">
                  {PERMISSIONS.map(p => (
                    <label key={p.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                      <input
                        type="checkbox"
                        checked={profile.permissions?.includes(p.id)}
                        onChange={(e) => {
                          const perms = profile.permissions || []
                          if (e.target.checked) {
                            setProfile(prev => ({ ...prev, permissions: [...perms, p.id] }))
                          } else {
                            setProfile(prev => ({ ...prev, permissions: perms.filter(id => id !== p.id) }))
                          }
                        }}
                        className="w-5 h-5 rounded text-purple-600"
                      />
                      <span className="text-sm font-medium text-slate-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleUpdateProfile}
              className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-600/20"
            >
              حفظ التعديلات 💾
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-6">تغيير كلمة المرور 🔑</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">كلمة المرور الجديدة</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                placeholder="••••••••"
              />
            </div>
            <button
              onClick={handleChangePassword}
              className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition shadow-lg shadow-slate-800/20"
            >
              تحديث كلمة المرور
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
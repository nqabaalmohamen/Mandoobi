import { useEffect, useState } from 'react'
import { useAuth } from '../../services/auth'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import CourierSidebar from '../../components/CourierSidebar'
import { getData, setData } from '../../services/db'

const STORAGE_KEY = 'mandoobi_users'
const COURIERS_KEY = 'mandoobi_couriers'

export default function CourierProfile() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState({ name: '', phone: '', vehicleType: '', nationalId: '' })
  const [profileInitialized, setProfileInitialized] = useState(false)
  const [courierData, setCourierData] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [stats, setStats] = useState({ totalOrders: 0, completedOrders: 0, pendingOrders: 0 })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Initialize profile ONCE when user first loads — prevents polling from wiping typed input
  useEffect(() => {
    if (!user || profileInitialized) return
    setProfile({
      name: user.name || '',
      phone: user.phone || '',
      vehicleType: user.vehicleType || '',
      nationalId: user.nationalId || ''
    })
    setProfileInitialized(true)
  }, [user, profileInitialized])

  // Fetch courier data & stats separately (runs on data changes without resetting form)
  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const couriers = await getData(COURIERS_KEY)
        const myCourierData = couriers.find(c => c.userId === user.uid || c.userId === user.id)
        setCourierData(myCourierData)

        // Also load nationalId from courierData if not in user object
        if (myCourierData?.nationalId && !user.nationalId) {
          setProfile(prev => ({ ...prev, nationalId: prev.nationalId || myCourierData.nationalId }))
        }

        const orders = await getData('mandoobi_orders')
        const myOrders = orders.filter(o => o.courierId === user.uid || o.courierId === user.id)
        setStats({
          totalOrders: myOrders.length,
          completedOrders: myOrders.filter(o => o.status === 'completed').length,
          pendingOrders: myOrders.filter(o => ['pending', 'accepted', 'preparing', 'on_way'].includes(o.status)).length
        })
      } catch (e) {
        console.error('Failed to fetch courier data:', e)
      }
    }

    fetchData()
    window.addEventListener('mandoobi_data_changed', fetchData)
    return () => window.removeEventListener('mandoobi_data_changed', fetchData)
  }, [user])

  const handleUpdateProfile = async () => {
    if (profile.phone && /^\d+$/.test(profile.phone) && (profile.phone.length !== 11 || !profile.phone.startsWith('01'))) {
      alert('يجب أن يبدأ رقم الهاتف بـ 01 ويتكون من 11 رقم بالضبط')
      return
    }
    if (!profile.name || !profile.phone) {
      setMsg({ text: 'يرجى ملء جميع الحقول المطلوبة', type: 'error' })
      return
    }

    try {
      const users = await getData(STORAGE_KEY)
      const index = users.findIndex(u => u.id === user.uid || u.id === user.id)

      if (index !== -1) {
        users[index] = { ...users[index], name: profile.name, phone: profile.phone, vehicleType: profile.vehicleType, nationalId: profile.nationalId }
        await setData(STORAGE_KEY, users)
        localStorage.setItem('mandoobi_user', JSON.stringify(users[index]))

        if (courierData) {
          const couriers = await getData(COURIERS_KEY)
          const cIndex = couriers.findIndex(c => c.userId === user.uid || c.userId === user.id)
          if (cIndex !== -1) {
            couriers[cIndex] = { ...couriers[cIndex], vehicleType: profile.vehicleType, nationalId: profile.nationalId }
            await setData(COURIERS_KEY, couriers)
          }
        }

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
      const users = await getData(STORAGE_KEY)
      const index = users.findIndex(u => u.id === user.uid || u.id === user.id)

      if (index !== -1) {
        users[index].password = newPassword
        await setData(STORAGE_KEY, users)
        setNewPassword('')
        setConfirmPassword('')
        setMsg({ text: 'تم تغيير كلمة المرور بنجاح ✅', type: 'success' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      }
    } catch (err) {
      setMsg({ text: 'فشل في تغيير كلمة المرور', type: 'error' })
    }
  }

  const statusLabels = {
    approved: 'مقبول',
    pending: 'قيد المراجعة',
    rejected: 'مرفوض'
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
          <button onClick={() => router.push('/')} className="px-10 py-4 bg-orange-600 text-white rounded-2xl font-black hover:bg-orange-700 transition-all shadow-lg inline-block">العودة للرئيسية</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Head>
        <title>الملف الشخصي | Mandoobi</title>
      </Head>

      <CourierSidebar 
        isOpen={mobileMenuOpen} 
        setIsOpen={setMobileMenuOpen} 
        activeTab="profile"
      />

      <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 sticky top-0 z-[100] lg:mr-72">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-800">الملف الشخصي 👤</h1>
          </div>
          <Link href="/dashboard/courier" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition text-sm">
            ← العودة للوحة التحكم
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 lg:mr-72">
        {msg.text && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            <span>{msg.type === 'success' ? '✅' : '⚠️'}</span>
            {msg.text}
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-l from-orange-600 to-orange-700 p-8 text-white">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center text-4xl font-black">
                {user?.name?.charAt(0) || 'م'}
              </div>
              <div>
                <h2 className="text-3xl font-black">{user?.name}</h2>
                <p className="text-orange-100 mt-1">{user?.role === 'courier' ? 'مندوب توصيل 🛵' : user?.role === 'admin' ? 'مدير النظام 👑' : 'عميل 👤'}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full">{stats.totalOrders} طلب</span>
                  <span className="bg-white/20 px-3 py-1 rounded-full">{stats.completedOrders} مكتمل</span>
                  <span className={`px-3 py-1 rounded-full ${courierData?.status === 'approved' ? 'bg-green-500/30' : courierData?.status === 'pending' ? 'bg-yellow-500/30' : 'bg-red-500/30'}`}>
                    {statusLabels[courierData?.status] || 'غير معروف'}
                  </span>
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
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
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
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">نوع المركبة</label>
                <select
                  value={profile.vehicleType}
                  onChange={(e) => setProfile(prev => ({ ...prev, vehicleType: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                >
                  <option value="">اختر نوع المركبة</option>
                  <option value="motorcycle">دراجة نارية</option>
                  <option value="car">سيارة</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">الرقم القومي</label>
                <input
                  type="text"
                  value={profile.nationalId}
                  onChange={(e) => setProfile(prev => ({ ...prev, nationalId: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                  placeholder="أدخل الرقم القومي"
                />
              </div>
            </div>

            <button
              onClick={handleUpdateProfile}
              className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition shadow-lg shadow-orange-600/20"
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
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
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
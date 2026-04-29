import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../services/auth'
import { subscribeToData } from '../../services/db'
import { subscribeToOrders, updateOrderStatus } from '../../services/orders'

import Link from 'next/link'
import Head from 'next/head'
import CourierSidebar from '../../components/CourierSidebar'

const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'

const STORAGE_KEYS = {
  USERS: 'mandoobi_users',
  ORDERS: 'mandoobi_orders',
  COURIERS: 'mandoobi_couriers',
  SUPPORT: 'mandoobi_support_requests'
}

const statusLabels = {
  pending: 'متاح ⏳',
  accepted: 'تم القبول ✅',
  preparing: 'قيد التجهيز 📦',
  on_way: 'في الطريق 🛵',
  delivered: 'وصل للموقع 📍',
  completed: 'تم التسليم 🎉',
  cancelled: 'ملغي ❌'
}

export default function CourierDashboard() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('available_orders')

  // Sync tab with URL
  useEffect(() => {
    if (router.isReady) {
      if (router.query.tab) {
        setActiveTab(router.query.tab)
      } else {
        router.replace({ query: { ...router.query, tab: 'available_orders' } }, undefined, { shallow: true })
      }
    }
  }, [router.isReady])

  useEffect(() => {
    if (router.isReady && activeTab && router.query.tab !== activeTab) {
      router.replace({ query: { ...router.query, tab: activeTab } }, undefined, { shallow: true })
    }
  }, [activeTab, router.isReady])

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [data, setData] = useState({
    users: [],
    orders: [],
    courierInfo: null,
    support: []
  })
  const [notifications, setNotifications] = useState([])
  const [isOnline, setIsOnline] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const prevOrdersRef = useRef([])
  const isOnlineRef = useRef(false)

  // Sync ref with state
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  const addNotify = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [{ id, msg, type }, ...prev].slice(0, 5))
    
    // Play sound for all notifications except info ones that aren't important
    if (type !== 'info' || msg.includes('طلب جديد')) {
      const audio = new Audio(NOTIFICATION_SOUND)
      audio.play().catch(e => console.log('Audio play blocked:', e))
    }

    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }, [])

  useEffect(() => {
    if (!user || user.role !== 'courier') return

    const unsubUsers = subscribeToData(STORAGE_KEYS.USERS, (users) => {
      setData(prev => ({ ...prev, users }))
    })

    const unsubOrders = subscribeToOrders((orders) => {
      // Check for new orders if courier is online
      if (isOnlineRef.current && prevOrdersRef.current.length > 0) {
        const newOrders = orders.filter(o => 
          !prevOrdersRef.current.some(prev => prev.id === o.id) && 
          (o.status === 'pending' || o.status === 'متاح')
        )
        
        if (newOrders.length > 0) {
          addNotify(`يوجد ${newOrders.length} طلب جديد متاح للقبول 📦`, 'success')
        }
      }
      prevOrdersRef.current = orders
      setData(prev => ({ ...prev, orders }))
    })

    const unsubCouriers = subscribeToData(STORAGE_KEYS.COURIERS, (couriers) => {
      const myInfo = couriers.find(c => c.userId === user.uid || c.userId === user.id)
      setData(prev => ({ ...prev, courierInfo: myInfo }))
    })

    const unsubSupport = subscribeToData(STORAGE_KEYS.SUPPORT, (support) => {
      setData(prev => ({ ...prev, support }))
    })

    const savedOnline = localStorage.getItem(`mandoobi_courier_online_${user.uid || user.id}`)
    setIsOnline(savedOnline === 'true')

    return () => {
      unsubUsers()
      unsubOrders()
      unsubCouriers()
      unsubSupport()
    }
  }, [user])

  const toggleOnlineStatus = () => {
    const newStatus = !isOnline
    setIsOnline(newStatus)
    localStorage.setItem(`mandoobi_courier_online_${user.uid || user.id}`, newStatus)
    addNotify(newStatus ? 'أنت الآن متصل وتستقبل طلبات جديدة 🟢' : 'أنت الآن غير متصل ولن تظهر لك طلبات جديدة 🔴', newStatus ? 'success' : 'info')
  }

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus, user.uid || user.id)
      addNotify(`تم تحديث حالة الطلب إلى: ${statusLabels[newStatus] || newStatus}`, 'success')
    } catch (err) {
      addNotify('حدث خطأ أثناء تحديث الحالة', 'error')
    }
  }

  useEffect(() => {
    if (user === null) {
      router.push('/')
    }
  }, [user, router])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-bold">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (user === null || user.role !== 'courier') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900" dir="rtl">
        <div className="text-center p-10 bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20">
          <div className="text-7xl mb-6">🔒</div>
          <h2 className="text-3xl font-black text-white mb-4">دخول غير مصرح</h2>
          <p className="text-slate-300 mb-8 text-lg">يرجى تسجيل الدخول بحساب مندوب.</p>
          <button onClick={() => router.push('/')} className="px-10 py-4 bg-orange-600 text-white rounded-2xl font-black hover:bg-orange-700 transition-all shadow-lg inline-block">العودة للرئيسية</button>
        </div>
      </div>
    )
  }

  const courierStatus = data.courierInfo?.status || 'pending'

  if (courierStatus === 'pending' || courierStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-xl w-full bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner ${
            courierStatus === 'rejected' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'
          }`}>
            {courierStatus === 'rejected' ? '❌' : '⏳'}
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">
            {courierStatus === 'rejected' ? 'تم رفض طلب الانضمام' : 'حسابك قيد المراجعة'}
          </h1>
          <p className="text-slate-500 mb-8 font-medium">
            {courierStatus === 'rejected' 
              ? 'عذراً، لم يتم قبول طلبك حالياً. يرجى التواصل مع الإدارة لمزيد من التفاصيل.' 
              : 'فريقنا يقوم بمراجعة بياناتك الآن. سنقوم بتفعيل حسابك فور التأكد من صحة البيانات.'}
          </p>
          <button onClick={signOut} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all">تسجيل الخروج</button>
        </div>
      </div>
    )
  }

  const getUserById = (id) => data.users.find(u => u.id === id)

  const availableOrders = data.orders
    .filter(o => (o.status === 'pending' || o.status === 'متاح') && isOnline)
    .sort((a, b) => new Date(b.createdAt || b.id) - new Date(a.createdAt || a.id))
    
  const myOrders = data.orders
    .filter(o => o.courierId === (user.uid || user.id))
    .sort((a, b) => new Date(b.createdAt || b.id) - new Date(a.createdAt || a.id))

  const completedOrders = myOrders.filter(o => o.status === 'completed')
  const activeMyOrders = myOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')

  const stats = {
    available: availableOrders.length,
    active: activeMyOrders.length,
    completed: completedOrders.length
  }

  const menuItems = [
    { id: 'available_orders', label: 'الطلبات المتاحة', icon: '📦', badge: stats.available },
    { id: 'my_active_orders', label: 'طلباتي النشطة', icon: '🛵', badge: stats.active },
    { id: 'history', label: 'سجل الطلبات', icon: '📜' },
    { id: 'support', label: 'الدعم الفني', icon: '💬' }
  ]

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <Head>
        <title>لوحة المندوب | Mandoobi</title>
      </Head>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white shadow-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-800">لوحة المندوب</h1>
        </div>
        
        <button
          onClick={toggleOnlineStatus}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
              : 'bg-slate-50 text-slate-400 border border-slate-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
          {isOnline ? 'أونلاين' : 'أوفلاين'}
        </button>
      </div>

      <CourierSidebar 
        isOpen={mobileMenuOpen} 
        setIsOpen={setMobileMenuOpen} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOnline={isOnline}
        toggleOnlineStatus={toggleOnlineStatus}
      />

      {/* Main Content */}
      <div className="lg:mr-72 min-h-screen">
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white shadow-sm border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {menuItems.find(m => m.id === activeTab)?.label || 'لوحة التحكم'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">مرحباً {user.name}، إليك ملخص مهامك</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard/courier-profile">
              <img 
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'م'}&background=FF6A00&color=fff`} 
                alt="" 
                className="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-orange-500 transition"
              />
            </Link>
          </div>
        </header>

        <div className="lg:hidden h-16" />

        <div className="p-4 lg:p-8">
          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="fixed bottom-24 left-4 right-4 lg:left-auto lg:right-8 lg:w-96 z-[200] space-y-2">
              {notifications.map(n => (
                <div key={n.id} className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up border ${
                  n.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
                  n.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' : 
                  'bg-blue-600 border-blue-500 text-white'
                }`}>
                  <span className="text-xl">{n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : 'ℹ️'}</span>
                  <p className="font-bold text-sm leading-relaxed">{n.msg}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase mb-1">متاح للقبول</p>
              <p className="text-3xl font-black text-blue-600">{stats.available}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase mb-1">نشط حالياً</p>
              <p className="text-3xl font-black text-orange-600">{stats.active}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase mb-1">مكتمل</p>
              <p className="text-3xl font-black text-emerald-600">{stats.completed}</p>
            </div>
          </div>

          {/* Content Tabs */}
          {activeTab === 'available_orders' && (
            <div className="space-y-6">
              {!isOnline && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex flex-col items-center text-center gap-4">
                  <div className="text-4xl">🔴</div>
                  <div>
                    <h3 className="text-lg font-bold text-amber-800">أنت حالياً غير متصل</h3>
                    <p className="text-amber-700 text-sm">يجب أن تكون متصلاً (أونلاين) لتتمكن من رؤية وقبول الطلبات الجديدة المتاحة في منطقتك.</p>
                  </div>
                  <button onClick={toggleOnlineStatus} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20">الذهاب أونلاين 🟢</button>
                </div>
              )}

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {availableOrders.length > 0 ? availableOrders.map(order => (
                  <OrderCard key={order.id} order={order} users={data.users} onAccept={() => handleUpdateOrderStatus(order.id, 'accepted')} />
                )) : (
                  isOnline && (
                    <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                      <div className="text-5xl mb-4">📦</div>
                      <h3 className="text-xl font-black text-slate-800">لا توجد طلبات متاحة حالياً</h3>
                      <p className="text-slate-400">سيتم تنبيهك فور توفر طلبات جديدة.</p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {activeTab === 'my_active_orders' && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeMyOrders.length > 0 ? activeMyOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  users={data.users} 
                  isMyOrder={true}
                  onStatusUpdate={(status) => handleUpdateOrderStatus(order.id, status)} 
                />
              )) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                  <div className="text-5xl mb-4">🛵</div>
                  <h3 className="text-xl font-black text-slate-800">ليس لديك طلبات نشطة حالياً</h3>
                  <p className="text-slate-400">ابدأ بقبول الطلبات من قائمة الطلبات المتاحة.</p>
                  <button onClick={() => setActiveTab('available_orders')} className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">تصفح الطلبات</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">رقم الطلب</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">التفاصيل</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">التاريخ</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">المبلغ</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedOrders.length > 0 ? completedOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-slate-900">#{o.id.toString().slice(-5)}</td>
                        <td className="px-6 py-4 text-slate-600 text-sm">{o.details}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{new Date(o.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{o.price} جنيه</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black">مكتمل ✅</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400">لا يوجد سجل طلبات مكتملة حتى الآن.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="max-w-2xl mx-auto space-y-6">
               <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
                  <div className="text-5xl mb-4">🎧</div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">الدعم الفني للمناديب</h3>
                  <p className="text-slate-500 mb-8">هل تواجه مشكلة في طلب أو في التطبيق؟ نحن هنا لمساعدتك.</p>
                  <Link href="/support" className="block w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all">فتح تذكرة دعم 💬</Link>
               </div>
            </div>
          )}
        </div>
      </div>


      <style jsx global>{`
        .pb-safe-area {
          padding-bottom: env(safe-area-inset-bottom);
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

function OrderCard({ order, users, onAccept, onStatusUpdate, isMyOrder }) {
  const client = order.clientType === 'guest'
    ? { name: order.guestName, phone: order.guestPhone, address: order.guestAddress }
    : users.find(u => u.id === order.clientId) || { name: 'عميل مسجل', phone: '---', address: '---' }

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group flex flex-col h-full relative overflow-hidden">
      {isMyOrder && <div className="absolute top-0 right-0 left-0 h-1 bg-orange-500"></div>}
      
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
          order.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
          isMyOrder ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
        }`}>
          {order.status === 'completed' ? '✅' : isMyOrder ? '🛵' : '📦'}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">قيمة التوصيل</div>
          <div className="text-2xl font-black text-slate-900">{order.price} <span className="text-xs font-medium">جنيه</span></div>
        </div>
      </div>

      <div className="space-y-4 mb-8 flex-grow">
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">العميل: {client.name}</div>
          <div className="text-sm font-black text-slate-800 line-clamp-2 leading-relaxed">{order.details}</div>
        </div>

        {/* Source info */}
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="text-[10px] font-black text-blue-600 mb-2 uppercase flex items-center justify-between">
            <span>📦 استلام من</span>
            <span>📍 {order.sourceAddress || '---'}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>{order.sourceName || 'المصدر'}</span>
            {order.sourcePhone && <a href={`tel:${order.sourcePhone}`} className="text-blue-600">📞 {order.sourcePhone}</a>}
          </div>
        </div>

        {/* Destination info */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <div className="text-[10px] font-black text-emerald-600 mb-2 uppercase flex items-center justify-between">
            <span>🏠 توصيل إلى</span>
            <span>📍 {client.address || '---'}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>{client.name}</span>
            {client.phone && client.phone !== '---' && <a href={`tel:${client.phone}`} className="text-emerald-600">📞 {client.phone}</a>}
          </div>
        </div>
      </div>

      <div className="mt-auto">
        {!isMyOrder ? (
          <button 
            onClick={onAccept}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-orange-600 transition-all text-sm shadow-lg shadow-slate-900/10"
          >
            قبول الطلب وتوصيله 🚀
          </button>
        ) : (
          <div className="space-y-3">
            <select
              value={order.status}
              onChange={(e) => onStatusUpdate(e.target.value)}
              className="w-full py-3 bg-orange-50 text-orange-700 border border-orange-100 rounded-xl font-black text-xs outline-none cursor-pointer hover:bg-orange-100 transition-all text-center appearance-none"
            >
              <option value="accepted">تم القبول ✅</option>
              <option value="preparing">قيد التجهيز 📦</option>
              <option value="on_way">في الطريق 🛵</option>
              <option value="delivered">وصل للموقع 📍</option>
              <option value="completed">تم التسليم 🎉</option>
            </select>
            <Link href={`/order/${order.id}`} className="block w-full py-3 bg-slate-100 text-slate-900 text-center rounded-xl font-black text-xs hover:bg-slate-200 transition-all">تتبع ومتابعة 🗺️</Link>
          </div>
        )}
      </div>
    </div>
  )
}
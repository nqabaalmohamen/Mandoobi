import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../services/auth'
import { subscribeToOrders, deleteOrder } from '../../services/orders'
import Link from 'next/link'
import Head from 'next/head'
import ClientSidebar from '../../components/ClientSidebar'

export default function ClientDashboard(){
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loadingDelete, setLoadingDelete] = useState(null)
  const [filter, setFilter] = useState('all')

  // Sync filter with URL
  useEffect(() => {
    if (router.isReady) {
      if (router.query.filter) {
        setFilter(router.query.filter)
      } else {
        router.replace({ query: { ...router.query, filter: 'all' } }, undefined, { shallow: true })
      }
    }
  }, [router.isReady])

  useEffect(() => {
    if (router.isReady && filter && router.query.filter !== filter) {
      router.replace({ query: { ...router.query, filter } }, undefined, { shallow: true })
    }
  }, [filter, router.isReady])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const menuItems = [
    { id: 'all', label: 'الكل', icon: '📦' },
    { id: 'active', label: 'تحت التنفيذ', icon: '🛵' },
    { id: 'completed', label: 'المكتملة', icon: '✅' },
    { id: 'profile', label: 'الملف الشخصي', icon: '👤' },
    { id: 'support', label: 'الدعم الفني', icon: '💬' }
  ]

  const handleDeleteOrder = async (orderId) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return
    
    try {
      setLoadingDelete(orderId)
      await deleteOrder(orderId)
      alert('تم حذف الطلب بنجاح')
    } catch (err) {
      alert('فشل في حذف الطلب: ' + err.message)
    } finally {
      setLoadingDelete(null)
    }
  }

  useEffect(()=>{
    if(!user) return
    const unsub = subscribeToOrders((allOrders) => {
      setOrders(allOrders.filter(o => o.clientId === user.uid))
    })
    return () => unsub()
  },[user])

  const filteredOrders = orders
    .filter(o => {
      if (filter === 'all') return true
      if (filter === 'active') return ['pending', 'accepted', 'preparing', 'on_way', 'delivered'].includes(o.status)
      if (filter === 'completed') return o.status === 'completed'
      return true
    })
    .sort((a, b) => {
      // Sort by createdAt descending, or by id if createdAt is missing
      const dateA = new Date(a.createdAt || a.id).getTime()
      const dateB = new Date(b.createdAt || b.id).getTime()
      return dateB - dateA
    })

  useEffect(() => {
    if (user === null) {
      router.push('/')
    }
  }, [user, router])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center p-10 bg-white rounded-3xl shadow-xl border border-slate-100">
          <div className="text-7xl mb-6">🔒</div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">يرجى تسجيل الدخول أولاً</h2>
          <button onClick={() => router.push('/')} className="px-10 py-4 bg-[#FF6A00] text-white rounded-2xl font-black hover:bg-[#FF8A3D] transition-all shadow-lg inline-block">العودة للرئيسية</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <Head>
        <title>طلباتي | Mandoobi</title>
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
          <h1 className="text-lg font-bold text-slate-800">طلباتي</h1>
        </div>
        <Link href="/order/create" className="px-4 py-2 bg-[#FF6A00] text-white rounded-xl text-xs font-black shadow-lg shadow-[#FF6A00]/20">
          طلب جديد 🚀
        </Link>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <ClientSidebar 
        isOpen={mobileMenuOpen} 
        setIsOpen={setMobileMenuOpen} 
        activeFilter={filter} 
        setFilter={setFilter} 
      />

      <div className="lg:mr-72 min-h-screen">
        <header className="hidden lg:flex items-center justify-between px-8 py-6 bg-white shadow-sm border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900">طلباتي 📦</h1>
            <p className="text-slate-500 mt-1 font-medium text-sm">مرحباً {user.name}، إليك ملخص طلباتك</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/order/create" className="px-8 py-3 bg-[#FF6A00] text-white rounded-2xl font-black shadow-lg shadow-[#FF6A00]/20 hover:bg-[#FF8A3D] transition-all">
              طلب جديد 🚀
            </Link>
          </div>
        </header>

        <div className="lg:hidden h-16" />

        <div className="p-4 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full py-16 sm:py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <div className="text-5xl sm:text-6xl mb-6">📦</div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800">لا توجد طلبات هنا</h3>
                <p className="text-slate-400 mt-2 font-medium">ابدأ الآن وقم بإنشاء طلبك الأول بكل سهولة.</p>
                <Link href="/order/create" className="mt-8 inline-block px-8 py-3 bg-slate-50 text-slate-900 rounded-xl font-black hover:bg-slate-100 transition-all border border-slate-200">اطلب الآن</Link>
              </div>
            ) : (
              filteredOrders.map(o => {
                const statusConfig = {
                  pending: { label: 'قيد الانتظار', color: 'bg-amber-50 text-amber-600 border-amber-100' },
                  accepted: { label: 'تم القبول', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                  preparing: { label: 'قيد التجهيز', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                  on_way: { label: 'في الطريق', color: 'bg-orange-50 text-orange-600 border-orange-100' },
                  delivered: { label: 'وصل للموقع', color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
                  completed: { label: 'تم التسليم', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                }
                const currentStatus = statusConfig[o.status] || statusConfig.pending

                return (
                  <div key={o.id} className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group flex flex-col h-full relative overflow-hidden">
                    <div className="flex justify-between items-start mb-8">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border shadow-inner ${currentStatus.color}`}>
                        {o.status === 'completed' ? '✅' : '📦'}
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">حالة الطلب</div>
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black border ${currentStatus.color}`}>
                          {currentStatus.label}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4 mb-8 flex-grow">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">رقم الطلب: #{o.id.toString().slice(-5)}</div>
                          <h3 className="text-lg font-black text-slate-900 line-clamp-2 leading-relaxed">{o.details}</h3>
                        </div>
                      </div>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">رقم الطلب</span>
                        <span className="text-xs font-bold text-slate-900">#{o.id.toString().slice(-5)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي المستحق</div>
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-2xl font-black text-[#FF6A00] tracking-tighter">{o.price}</span>
                          <span className="text-[10px] font-bold text-slate-400">EGP</span>
                        </div>
                      </div>
                    </div>
                    </div>
                    <div className="flex gap-3 mt-auto">
                      <Link href={`/order/${o.id}`} className="flex-1 py-4 bg-slate-900 text-white text-center rounded-2xl font-black text-sm hover:bg-[#FF6A00] transition-all">
                        التفاصيل
                      </Link>
                      {['pending', 'accepted'].includes(o.status) && (
                        <>
                          <Link href={`/order/edit/${o.id}`} className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all border border-blue-100">
                            ✏️
                          </Link>
                          <button 
                            onClick={() => handleDeleteOrder(o.id)}
                            disabled={loadingDelete === o.id}
                            className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 border border-rose-100"
                          >
                            {loadingDelete === o.id ? '...' : '🗑️'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { subscribeToOrder, deleteOrder } from '../../services/orders'
import { useAuth } from '../../services/auth'
import Link from 'next/link'

export default function OrderPage(){
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState(null)
  const [clientInfo, setClientInfo] = useState(null)
  const [courierInfo, setCourierInfo] = useState(null)
  const [loadingDelete, setLoadingDelete] = useState(false)

  const handleDeleteOrder = async () => {
    if(!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return

    try {
      setLoadingDelete(true)
      await deleteOrder(id)
      alert('تم حذف الطلب بنجاح')
      router.push('/dashboard/client')
    } catch (err) {
      alert('فشل في حذف الطلب: ' + err.message)
    } finally {
      setLoadingDelete(false)
    }
  }

  useEffect(()=>{
    if(!id) return
    const unsub = subscribeToOrder(id, (o) => {
      if (!o) {
        setOrder(null)
        return
      }
      setOrder(o)

      // Fetch Client Info
      if (o.clientType === 'user' && o.clientId) {
        const users = JSON.parse(localStorage.getItem('mandoobi_users') || '[]')
        const found = users.find(u => u.id === o.clientId)
        if (found) setClientInfo(found)
      }

      // Fetch Courier Info
      if (o.courierId) {
        try {
          const users = JSON.parse(localStorage.getItem('mandoobi_users') || '[]')
          const found = users.find(u => u.id === o.courierId)
          if (found) {
            setCourierInfo(found)
          } else {
            // If not found in localStorage, try to get from server
            fetch(`/api/storage?key=mandoobi_users`)
              .then(res => res.json())
              .then(users => {
                const found = users.find(u => u.id === o.courierId)
                if (found) setCourierInfo(found)
              })
              .catch(err => console.error('Failed to fetch courier info:', err))
          }
        } catch (e) {
          console.error('Error fetching courier info:', e)
        }
      }
    })
    return () => unsub()
  },[id])

  if(!order) return <div className="p-6 text-center">جاري التحميل...</div>

  // منطق الخصوصية المحدث:
  const createdAt = order.createdAt?.seconds ? (order.createdAt.seconds * 1000) : new Date(order.createdAt).getTime()
  const diffMins = (Date.now() - createdAt) / (1000 * 60)
  const isExpiredForGuest = !user && (order.status === 'completed' || diffMins > 30)

  if (isExpiredForGuest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-xl w-full bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center">
          <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">🔒</div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">{order.status === 'completed' ? 'هذا الطلب مكتمل' : 'انتهت صلاحية التتبع'}</h1>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            {order.status === 'completed'
              ? 'لأسباب أمنية وحماية لخصوصية العملاء، لا يمكن عرض بيانات الطلبات المكتملة لغير المسجلين.'
              : 'عذراً، هذا الطلب مر عليه أكثر من 30 دقيقة ولا يمكن تتبعه بدون تسجيل دخول.'}
            يرجى تسجيل الدخول أو إنشاء حساب لمشاهدة سجل طلباتك بالكامل.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/login" className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all">دخول</a>
            <a href="/register" className="px-10 py-5 bg-[#FF6A00] text-white rounded-2xl font-black text-lg hover:bg-[#FF8A3D] transition-all shadow-xl shadow-[#FF6A00]/20">إنشاء حساب</a>
          </div>
        </div>
      </div>
    )
  }

  const statusMap = {
    'pending': { label: 'قيد المعالجة ⏳', color: 'amber', step: 1 },
    'accepted': { label: 'تم قبول الطلب ✅', color: 'blue', step: 2 },
    'preparing': { label: 'قيد التجهيز 📦', color: 'blue', step: 3 },
    'on_way': { label: 'في الطريق 🛵', color: 'blue', step: 4 },
    'delivered': { label: 'وصل للموقع 📍', color: 'blue', step: 5 },
    'completed': { label: 'تم التسليم بنجاح 🎉', color: 'emerald', step: 6 },
    'cancelled': { label: 'ملغي ❌', color: 'rose', step: 0 }
  }

  const currentStatus = statusMap[order.status] || { label: order.status, color: 'slate', step: 1 }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-slate-50" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Order Header */}
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">تتبع طلبك #{order.id}</h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">متابعة لحظية لحالة الشحنة</p>
              </div>
              <div className={`px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-${currentStatus.color}-500/10 bg-${currentStatus.color}-50 text-${currentStatus.color}-600 border border-${currentStatus.color}-100`}>
                {currentStatus.label}
              </div>
            </div>

            {/* Visual Tracking Steps */}
            <div className="relative py-12 px-4">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
              <div
                className="absolute top-1/2 right-0 h-1 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-1000"
                style={{ width: `${Math.max(0, (currentStatus.step - 1) * 20)}%` }}
              ></div>

              <div className="relative z-10 flex justify-between">
                {[
                  { s: 1, icon: '⏳', label: 'بانتظار القبول' },
                  { s: 2, icon: '✅', label: 'تم القبول' },
                  { s: 3, icon: '📦', label: 'تجهيز' },
                  { s: 4, icon: '🛵', label: 'في الطريق' },
                  { s: 5, icon: '📍', label: 'وصل' },
                  { s: 6, icon: '🎉', label: 'تم' }
                ].map((step) => (
                  <div key={step.s} className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all duration-500 ${
                      currentStatus.step >= step.s ? 'bg-blue-600 text-white scale-110 shadow-blue-200' : 'bg-white text-slate-300 border border-slate-100'
                    }`}>
                      {step.icon}
                    </div>
                    <span className={`text-[10px] font-black ${currentStatus.step >= step.s ? 'text-blue-600' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Show assigned courier info to all users when order is accepted or preparing */}
          {order.courierId && ['accepted', 'preparing', 'on_way', 'delivered'].includes(order.status) && (
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-blue-800">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">🛵</span>
                <h3 className="font-bold text-sm">مندوبك المخصص</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-lg overflow-hidden">
                  {courierInfo?.profileImage ? <img src={courierInfo.profileImage} className="w-full h-full object-cover" /> : '👤'}
                </div>
                <div>
                  <div className="font-bold">{courierInfo?.name || 'مندوب النظام'}</div>
                  <div className="text-xs font-medium">سيقوم بتوصيل طلبك</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Details */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">📝</span>
                محتويات الطلب
              </h3>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 font-bold leading-relaxed">
                {order.details}
              </div>

              {/* عرض اسم المندوب في حالة وجوده */}
              {order.courierId && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="text-sm font-black text-slate-600 mb-4">مندوب التوصيل:</div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-xl overflow-hidden">
                        {courierInfo?.profileImage ? <img src={courierInfo.profileImage} className="w-full h-full object-cover" /> : '👤'}
                      </div>
                      <div>
                        <div className="font-bold text-blue-800 text-lg">{courierInfo?.name || 'غير محدد'}</div>
                        <div className="text-xs text-blue-600 font-bold">رقم: {courierInfo?.phone || 'غير محدد'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-100">
                      <div className="text-xs text-blue-600 font-bold">حالة الطلب: <span className="text-blue-900">{order.status}</span></div>
                      <div className="text-xs text-blue-600 font-bold">وقت الطلب: <span className="text-blue-900">{new Date(order.createdAt?.seconds * 1000 || Date.now()).toLocaleString('ar-EG')}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">💵</span>
                الدفع والتكلفة
              </h3>
              <div className="flex justify-between items-center p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                <div>
                  <div className="text-[10px] font-black text-emerald-600 uppercase mb-1">طريقة الدفع</div>
                  <div className="text-sm font-black text-slate-800">
                    {order.paymentMethod === 'cash' ? 'كاش (نقداً) 💵' :
                     order.paymentMethod === 'vodafone_cash' ? 'فودافون كاش 📱' : 'انستا باي 💳'}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black text-emerald-600 uppercase mb-1">المبلغ الإجمالي</div>
                  <div className="text-3xl font-black text-emerald-700">
                    {order.price} <span className="text-sm font-medium">EGP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">مواقع التوصيل</h3>

              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-2 mr-2">📍 نقطة الاستلام (المصدر)</div>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-xs font-bold text-slate-700 leading-relaxed">
                    {order.sourceAddress || 'غير محدد'}
                  </div>
                </div>

                <div className="relative h-4 flex items-center justify-center">
                  <div className="w-px h-full bg-slate-200 border-dashed border-l"></div>
                </div>

                <div>
                  <div className="text-[10px] font-black text-emerald-600 uppercase mb-2 mr-2">🏁 نقطة التسليم (العميل)</div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs font-bold text-slate-700 leading-relaxed">
                    {order.deliveryAddress || order.guestAddress || 'غير محدد'}
                  </div>
                </div>
              </div>

              {/* بيانات العميل */}
              {(user?.role === 'admin' || user?.uid === order.clientId || user?.uid === order.courierId || order.clientType === 'guest') && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h4 className="text-xs font-black text-emerald-600 uppercase mb-4 tracking-widest flex items-center gap-1 justify-end">
                    <span>معلومات العميل</span>
                    <span>👤</span>
                  </h4>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-right">
                    <div className="mb-3 flex items-center gap-2 justify-end">
                      <span className="text-xs text-emerald-600 font-bold">الاسم:</span>
                      <span className="text-sm font-bold text-emerald-800">{order.clientType === 'guest' ? order.guestName : (clientInfo?.name || 'عميل مسجل')}</span>
                    </div>
                    <div className="mb-3 flex items-center gap-2 justify-end">
                      <span className="text-xs text-emerald-600 font-bold">الهاتف:</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {(user?.role === 'admin' || user?.uid === order.courierId || order.clientType === 'guest')
                          ? (order.clientType === 'guest' ? order.guestPhone : clientInfo?.phone)
                          : 'رقم الهاتف محمي 🔒'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-emerald-600 font-bold">العنوان:</span>
                      <span className="text-sm font-bold text-emerald-700 truncate">{order.deliveryAddress || order.guestAddress || 'غير محدد'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* بيانات المندوب */}
            {order.courierId && (
              <div className="bg-blue-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full -mb-12 -mr-12"></div>
                <h3 className="text-xs font-black text-white/40 uppercase mb-6 tracking-widest flex items-center gap-1 justify-end">
                  <span>معلومات المندوب</span>
                  <span>🛵</span>
                </h3>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl overflow-hidden">
                    {courierInfo?.profileImage ? <img src={courierInfo.profileImage} className="w-full h-full object-cover" /> : '🛵'}
                  </div>
                  <div>
                    <div className="font-black text-lg flex items-center gap-2 justify-end">
                      <span>{courierInfo?.name || 'غير محدد'}</span>
                      <span>🛵</span>
                    </div>
                    <div className="text-xs text-white/60 font-bold">مندوب التوصيل</div>
                  </div>
                </div>

                <div className="p-4 bg-blue-800/30 rounded-2xl border border-blue-700/50 text-right mb-6">
                  <div className="mb-3 flex items-center gap-2 justify-end">
                    <span className="text-xs text-blue-200 font-bold">الهاتف:</span>
                    <span className="text-sm font-bold text-blue-100">{courierInfo?.phone || 'غير محدد'}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-blue-200 font-bold">المركبة:</span>
                    <span className="text-sm font-bold text-blue-100">
                      {courierInfo?.vehicleType === 'motorcycle' ? 'موتوسيكل' : 
                       courierInfo?.vehicleType === 'car' ? 'سيارة' : 'دراجة'}
                    </span>
                  </div>
                </div>

                {/* Only show call button to the Client or Admin */}
                {(user?.role === 'admin' || user?.uid === order.clientId || order.clientType === 'guest') && (
                  <a
                    href={`tel:${courierInfo?.phone}`}
                    className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <span>📞</span> اتصال بالمندوب
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 pt-4">
          {user?.uid === order.clientId && ['pending', 'accepted'].includes(order.status) && (
            <>
              <Link
                href={`/order/edit/${order.id}`}
                className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
              >
                <span>✏️</span> تعديل الطلب
              </Link>
              <button
                onClick={handleDeleteOrder}
                disabled={loadingDelete}
                className="px-10 py-5 bg-rose-50 text-rose-600 rounded-2xl font-black text-sm hover:bg-rose-600 hover:text-white transition-all border border-rose-100 disabled:opacity-50"
              >
                {loadingDelete ? 'جاري الحذف...' : '🗑️ حذف الطلب'}
              </button>
            </>
          )}
          <button onClick={() => window.print()} className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg flex items-center gap-2">
            <span>🖨️</span> طباعة الفاتورة
          </button>
          <button onClick={() => router.back()} className="px-10 py-5 bg-white text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-50 border border-slate-200 transition-all">العودة للخلف</button>
        </div>
      </div>
    </div>
  )
}

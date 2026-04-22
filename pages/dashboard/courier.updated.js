import { useEffect, useState } from 'react'
import { useAuth } from '../../services/auth'
import { subscribeToOrders, updateOrderStatus } from '../../services/orders'

export default function CourierDashboard(){
  const { user, signOut } = useAuth()
  const [orders, setOrdersState] = useState([])
  const [filter, setFilter] = useState('available') // 'available' | 'my_orders'
  const [currentStatus, setCurrentStatus] = useState(user?.courierStatus || 'pending')
  const [statusReason, setStatusReason] = useState(user?.courierStatusReason || '')
  const [isEditing, setIsEditing] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isOnline, setIsOnline] = useState(false)

  const addNotify = (msg, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [{ id, msg, type }, ...prev].slice(0, 5))
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }
  const [editData, setEditData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    nationalId: '',
    vehicleType: 'motorcycle'
  })

  // 1. Sync status and data with DB in real-time
  useEffect(() => {
    if (!user?.uid) return
    const handler = async () => {
      try {
        const res = await fetch('/api/storage?key=mandoobi_users')
        const users = await res.json()
        const me = users.find(u => u.id === user.uid)
        if (me) {
          setCurrentStatus(me.courierStatus || 'pending')
          setStatusReason(me.courierStatusReason || '')

          // Update edit data if not currently editing
          if (!isEditing) {
            const cRes = await fetch('/api/storage?key=mandoobi_couriers')
            const couriers = await cRes.json()
            const courierInfo = couriers.find(c => c.userId === user.uid)
            setEditData({
              name: me.name || '',
              phone: me.phone || '',
              address: me.address || '',
              nationalId: courierInfo?.nationalId || '',
              vehicleType: courierInfo?.vehicleType || 'motorcycle'
            })
          }
        }
      } catch (e) {
        console.error('Failed to sync courier status:', e)
      }
    }

    // Polling for status updates from admin
    const interval = setInterval(handler, 2000)
    window.addEventListener('mandoobi_data_changed', handler)
    window.addEventListener('storage', handler)
    handler() // Initial check

    // Load online status from localStorage (this can stay local to device or move to server)
    const savedStatus = localStorage.getItem(`mandoobi_courier_online_${user.uid}`)
    setIsOnline(savedStatus === 'true')

    return () => {
      clearInterval(interval)
      window.removeEventListener('mandoobi_data_changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [user, isEditing])

  // 2. Load orders if approved
  useEffect(()=>{
    if(currentStatus === 'approved') {
      const unsub = subscribeToOrders((allOrders) => {
        // Only show orders if the courier is online, or if they are the courier's own orders
        const filtered = allOrders.filter(o => {
          const isMyOrder = o.courierId === user.uid;
          const isAvailable = (o.status === 'pending' || o.status === 'متاح');

          if (isMyOrder) return true;
          if (isAvailable && isOnline) return true;
          return false;
        });
        setOrdersState(filtered);
      })
      return () => unsub()
    }
  },[currentStatus, user?.uid, isOnline])

  const toggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    localStorage.setItem(`mandoobi_courier_online_${user.uid}`, newStatus);
    addNotify(newStatus ? 'أنت الآن متصل وتستقبل طلبات جديدة 🟢' : 'أنت الآن غير متصل ولن تظهر لك طلبات جديدة 🔴', newStatus ? 'success' : 'info');
  };

  const handleUpdateData = async () => {
    try {
      // 1. Update users list on server
      const res = await fetch('/api/storage?key=mandoobi_users')
      const users = await res.json()
      const updatedUsers = users.map(u => u.id === user.uid ? {
        ...u,
        name: editData.name,
        phone: editData.phone,
        address: editData.address,
        courierStatus: 'pending', // Reset to pending
        courierStatusReason: '' // Clear reason
      } : u)

      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'mandoobi_users', value: updatedUsers })
      })

      // 2. Update couriers list on server
      const cRes = await fetch('/api/storage?key=mandoobi_couriers')
      const couriers = await cRes.json()
      const updatedCouriers = couriers.map(c => c.userId === user.uid ? {
        ...c,
        nationalId: editData.nationalId,
        vehicleType: editData.vehicleType,
        status: 'pending'
      } : c)

      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'mandoobi_couriers', value: updatedCouriers })
      })

      // 3. Notify changes
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      setIsEditing(false)
      addNotify('تم تحديث البيانات بنجاح، طلبك الآن قيد المراجعة.', 'success')
    } catch (err) {
      addNotify('حدث خطأ أثناء تحديث البيانات', 'error')
    }
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus, user.uid)
      addNotify(`تم تحديث حالة الطلب إلى: ${statusMap[newStatus]}`, 'success')
    } catch (err) {
      addNotify('حدث خطأ أثناء تحديث الحالة', 'error')
    }
  }

  const statusMap = {
    'pending': 'متاح ⏳',
    'accepted': 'تم القبول ✅',
    'preparing': 'قيد التجهيز 📦',
    'on_way': 'في الطريق 🛵',
    'delivered': 'وصل للموقع 📍',
    'completed': 'تم التسليم 🎉',
    'cancelled': 'ملغي ❌'
  }

  if(!user || user.role !== 'courier') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
        <div className="text-5xl mb-6">🔒</div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">دخول غير مصرح</h2>
        <p className="text-slate-500">يرجى تسجيل الدخول بحساب مندوب.</p>
        <a href="/login" className="mt-6 block py-3 bg-blue-600 text-white rounded-2xl font-bold">تسجيل الدخول</a>
      </div>
    </div>
  )

  if(currentStatus === 'pending' || currentStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        {/* Notifications Toast */}
        <div className="fixed top-6 left-6 z-[100] space-y-3 w-80">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-2xl shadow-2xl border animate-in slide-in-from-left-full duration-500 flex items-center gap-3 ${
              n.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <span className="text-xl">{n.type === 'error' ? '❌' : n.type === 'success' ? '✅' : 'ℹ️'}</span>
              <p className="text-xs font-bold leading-relaxed">{n.msg}</p>
            </div>
          ))}
        </div>
        <div className="max-w-xl w-full bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center">
          {!isEditing ? (
            <>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner ${
                currentStatus === 'rejected' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'
              }`}>
                {currentStatus === 'rejected' ? '❌' : '⏳'}
              </div>

              <h1 className="text-3xl font-black text-slate-900 mb-4">
                {currentStatus === 'rejected' ? 'تم رفض طلب الانضمام' : 'حسابك قيد المراجعة'}
              </h1>

              <div className={`p-6 rounded-2xl mb-8 text-right border ${
                currentStatus === 'rejected' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50 border-amber-100 text-amber-800'
              }`}>
                <p className="text-sm font-bold leading-relaxed">
                  {currentStatus === 'rejected'
                    ? (statusReason || 'عذراً، لم يتم قبول طلبك للانضمام لفريق مندو بي في الوقت الحالي.')
                    : (statusReason || 'فريقنا يقوم بمراجعة بياناتك ووثائقك الآن. سنقوم بتفعيل حسابك فور التأكد من صحة البيانات.')}
                </p>
              </div>

              {currentStatus === 'rejected' && (
                <div className="space-y-4 mb-8">
                  <p className="text-slate-500 text-xs font-bold">يمكنك تعديل بياناتك وإعادة إرسال الطلب للمراجعة.</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                  >
                    تعديل البيانات وإعادة التقديم 📝
                  </button>
                </div>
              )}

              <button onClick={signOut} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all">تسجيل الخروج</button>
            </>
          ) : (
            <div className="text-right">
              <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">تعديل بيانات الحساب</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={e => setEditData({...editData, name: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={e => setEditData({...editData, phone: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1">العنوان</label>
                  <input
                    type="text"
                    value={editData.address}
                    onChange={e => setEditData({...editData, address: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1">الرقم القومي</label>
                  <input
                    type="text"
                    value={editData.nationalId}
                    onChange={e => setEditData({...editData, nationalId: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1">نوع المركبة</label>
                  <select
                    value={editData.vehicleType}
                    onChange={e => setEditData({...editData, vehicleType: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="motorcycle">موتوسيكل</option>
                    <option value="car">سيارة</option>
                    <option value="bicycle">دراجة</option>
                  </select>
                </div>
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={handleUpdateData}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all"
                  >حفظ وإرسال 🚀</button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                  >إلغاء</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-10 bg-slate-50 min-h-screen font-sans max-w-[100%]" dir="rtl">
      {/* Notifications Toast */}
      <div className="fixed top-6 left-6 z-[100] space-y-3 w-[calc(100%-3rem)] sm:w-80">
        {notifications.map(n => (
          <div key={n.id} className={`p-4 rounded-2xl shadow-2xl border animate-in slide-in-from-left-full duration-500 flex items-center gap-3 ${
            n.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <span className="text-xl">{n.type === 'error' ? '❌' : n.type === 'success' ? '✅' : 'ℹ️'}</span>
            <p className="text-xs font-bold leading-relaxed">{n.msg}</p>
          </div>
        ))}
      </div>

      <header className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-10 px-2 sm:px-6 lg:px-12">
        <div className="text-center lg:text-right">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">لوحة المندوب النشطة 🛵</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm sm:text-base">مرحباً {user.name}، تصفح الطلبات أو تابع مهامك.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
          <button
            onClick={toggleOnlineStatus}
            className={`w-full sm:w-auto px-6 py-3 sm:py-2 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 border shadow-sm ${
              isOnline
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
            {isOnline ? 'أنت متصل الآن' : 'غير متصل (أوفلاين)'}
          </button>
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex w-full sm:w-auto">
            <button
              onClick={() => setFilter('available')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${filter === 'available' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >الطلبات المتاحة</button>
            <button
              onClick={() => setFilter('my_orders')}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${filter === 'my_orders' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >طلباتي الخاصة</button>
          </div>
          <button onClick={signOut} className="w-full sm:w-auto px-6 py-2 bg-red-50 text-red-600 rounded-xl font-black text-sm hover:bg-red-600 hover:text-white transition-all">خروج</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 px-2 sm:px-6 lg:px-12">
        {orders.filter(o => filter === 'available' ? (o.status === 'pending' || o.status === 'متاح') : o.courierId === user.uid).length === 0 ? (
          <div className="col-span-full py-12 sm:py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 mx-2 sm:mx-0">
            <div className="text-4xl sm:text-5xl mb-4">📦</div>
            <h3 className="text-lg sm:text-xl font-black text-slate-800">
              {filter === 'available' ? 'لا توجد طلبات متاحة حالياً' : 'ليس لديك طلبات حالية'}
            </h3>
            <p className="text-sm sm:text-base text-slate-400 px-6">
              {filter === 'available' ? 'سيتم تنبيهك فور توفر طلبات جديدة في منطقتك.' : 'يمكنك قبول طلبات جديدة من تبويب الطلبات المتاحة.'}
            </p>
          </div>
        ) : (
          orders.filter(o => filter === 'available' ? (o.status === 'pending' || o.status === 'متاح') : o.courierId === user.uid).map(o=> {
            const users = JSON.parse(localStorage.getItem('mandoobi_users') || '[]')
            const client = o.clientType === 'guest'
              ? { name: o.guestName, phone: o.guestPhone, address: o.guestAddress }
              : users.find(u => u.id === o.clientId) || { name: 'عميل مسجل', phone: '---', address: '---' };

            return (
              <div key={o.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full">
                {o.courierId === user.uid && (
                  <div className="absolute top-0 right-0 left-0 h-1 bg-blue-600"></div>
                )}
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                    o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                    o.status === 'accepted' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {o.status === 'completed' ? '✅' : o.status === 'accepted' ? '🛵' : '📦'}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase">قيمة الطلب</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900">{o.price} <span className="text-xs sm:text-sm font-medium">EGP</span></div>
                  </div>
                </div>
                <div className="space-y-4 mb-8 flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">العميل: {client.name}</div>
                      <div className="text-sm font-black text-slate-800 line-clamp-2">{o.details}</div>
                    </div>
                    {o.courierId === user.uid && (
                      <span className={`text-[9px] px-2 py-1 rounded-lg font-black whitespace-nowrap ${
                        o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {o.status === 'completed' ? 'مكتمل' : 'قيد التوصيل'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 font-bold">
                      <span className="flex-shrink-0">📞</span> {client.phone}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 font-bold">
                      <span className="flex-shrink-0">📍</span> <span className="truncate">{client.address || 'القاهرة، مصر'}</span>
                    </div>
                  </div>

                  {/* بيانات مصدر التوصيل */}
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mt-4">
                    <div className="text-[10px] font-black text-blue-600 mb-2 uppercase flex items-center gap-1 justify-end">
                      <span>معلومات مصدر التوصيل</span>
                      <span>📦</span>
                    </div>
                    <div className="text-xs sm:text-sm font-black text-slate-800 mb-1 flex items-center gap-2 justify-end">
                      <span>الاسم:</span>
                      <span className="text-blue-600">{o.sourceName || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 mb-1">
                      <span className="flex-shrink-0">📞</span>
                      <div className="flex items-center gap-1 justify-end w-full">
                        <span>الهاتف:</span>
                        <span className="font-bold text-blue-600">{o.sourcePhone || 'غير محدد'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                      <span className="flex-shrink-0">📍</span>
                      <div className="flex items-center gap-1 justify-end w-full">
                        <span>العنوان:</span>
                        <span className="font-bold text-blue-600 truncate">{o.sourceAddress || 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>

                  {/* بيانات وجهة التوصيل */}
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 mt-3">
                    <div className="text-[10px] font-black text-emerald-600 mb-2 uppercase flex items-center gap-1 justify-end">
                      <span>معلومات وجهة التوصيل</span>
                      <span>🏠</span>
                    </div>
                    <div className="text-xs sm:text-sm font-black text-slate-800 mb-1 flex items-center gap-2 justify-end">
                      <span>الاسم:</span>
                      <span className="text-emerald-600">{client.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 mb-1">
                      <span className="flex-shrink-0">📞</span>
                      <div className="flex items-center gap-1 justify-end w-full">
                        <span>الهاتف:</span>
                        <span className="font-bold text-emerald-600">{client.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                      <span className="flex-shrink-0">📍</span>
                      <div className="flex items-center gap-1 justify-end w-full">
                        <span>العنوان:</span>
                        <span className="font-bold text-emerald-600 truncate">{client.address || 'القاهرة، مصر'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-auto">
                  {o.status === 'pending' || o.status === 'متاح' ? (
                    <button onClick={()=>handleUpdateStatus(o.id, 'accepted')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black group-hover:bg-blue-600 transition-all text-sm">قبول الطلب وتوصيله</button>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={o.status}
                        onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                        className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl font-black text-xs outline-none cursor-pointer hover:bg-blue-100 transition-all text-center appearance-none"
                      >
                        <option value="accepted">تم القبول ✅</option>
                        <option value="preparing">قيد التجهيز 📦</option>
                        <option value="on_way">في الطريق 🛵</option>
                        <option value="delivered">وصل للموقع 📍</option>
                        <option value="completed">تم التسليم 🎉</option>
                      </select>
                      <a href={`/order/${o.id}`} className="block w-full py-3 bg-slate-100 text-slate-900 text-center rounded-xl font-black text-xs hover:bg-slate-200 transition-all">تتبع ومتابعة 🗺️</a>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

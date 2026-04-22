import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { subscribeToOrder, deleteOrder, createOrder } from '../../services/orders'
import { useAuth } from '../../services/auth'
import Link from 'next/link'
import Head from 'next/head'

export default function OrderPage(){
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const isCreateMode = id === 'create'

  const [order, setOrder] = useState(null)
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false)
  const [clientInfo, setClientInfo] = useState(null)
  const [courierInfo, setCourierInfo] = useState(null)
  const [loadingDelete, setLoadingDelete] = useState(false)

  // Form states for Create Mode
  const [details, setDetails] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transferImage, setTransferImage] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [sourcePhone, setSourcePhone] = useState('')
  const [sourceAddress, setSourceAddress] = useState('')
  const [orderType, setOrderType] = useState('individual')
  const [serviceAmount, setServiceAmount] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({ baseFare: 30, commission: 5, commissionType: 'fixed' })

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

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if(!f) return
    setError('')
    const reader = new FileReader()
    reader.onloadend = () => setTransferImage(reader.result)
    reader.readAsDataURL(f)
  }

  const handleSubmitOrder = async (e) => {
    e.preventDefault()
    setError('')

    // Guard: only logged-in users can create orders
    if (!user) {
      router.push('/login')
      return
    }
    
    if (!details) {
      setError('يرجى إدخال تفاصيل الطلب')
      return
    }
    if (!sourceName) {
      setError('يرجى إدخال اسم مصدر التوصيل')
      return
    }
    if (orderType === 'individual') {
      if (!sourcePhone) {
        setError('يرجى إدخال رقم هاتف مصدر التوصيل')
        return
      }
      if (sourcePhone !== 'admin' && (sourcePhone.length !== 11 || !/^\d+$/.test(sourcePhone) || !sourcePhone.startsWith('01'))) {
        setError('رقم هاتف المصدر يجب أن يبدأ بـ 01 ويتكون من 11 رقم بالضبط')
        return
      }
    }
    if (orderType !== 'individual' && !serviceAmount) {
      setError('يرجى إدخال المبلغ المطلوب')
      return
    }
    if (!sourceAddress) {
      setError('يرجى إدخال عنوان مصدر التوصيل بالتفصيل')
      return
    }
    if ((paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') && !transferImage) {
      setError('يرجى رفع صورة التحويل')
      return
    }

    setLoading(true)
    try {
      const payload = {
        clientId: user.uid,
        clientType: 'user',
        details,
        paymentMethod,
        sourceName,
        sourcePhone: orderType === 'individual' ? sourcePhone : null,
        sourceAddress,
        orderType,
        serviceAmount: orderType !== 'individual' ? parseFloat(serviceAmount) : null,
        baseFare: parseFloat(settings.baseFare),
        commission: settings.commissionType === 'percentage' 
          ? (parseFloat(settings.baseFare) * (parseFloat(settings.commission) / 100))
          : parseFloat(settings.commission),
        price: parseFloat(settings.baseFare) + (settings.commissionType === 'percentage' 
          ? (parseFloat(settings.baseFare) * (parseFloat(settings.commission) / 100))
          : parseFloat(settings.commission)),
        status: 'pending',
        transferImage: transferImage || null,
        createdAt: new Date().toISOString()
      }
      const newId = await createOrder(payload)
      alert('تم إنشاء الطلب بنجاح')
      router.push(`/order/${newId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{
    if(!id || isCreateMode) return
    const unsub = subscribeToOrder(id, (o) => {
      if (!o) {
        setOrder(null)
        return
      }
      setOrder(o)
      
      // Fetch Client Info
      if (o.clientType === 'user' && o.clientId) {
        try {
          const users = JSON.parse(localStorage.getItem('mandoobi_users') || '[]')
          const found = users.find(u => u.id === o.clientId)
          if (found) {
            setClientInfo(found)
          } else {
            fetch(`/api/storage?key=mandoobi_users`)
              .then(res => res.json())
              .then(users => {
                const found = users.find(u => u.id === o.clientId)
                if (found) setClientInfo(found)
              })
              .catch(err => console.error('Failed to fetch client info:', err))
          }
        } catch (e) {
          console.error('Error fetching client info:', e)
        }
      }

      // Fetch Courier Info
      if (o.courierId) {
        try {
          const users = JSON.parse(localStorage.getItem('mandoobi_users') || '[]')
          const found = users.find(u => u.id === o.courierId)
          if (found) {
            setCourierInfo(found)
          } else {
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
  },[id, isCreateMode])

   useEffect(() => {
     if (!isCreateMode) return

     // Redirect unauthenticated users to login page
     if (user === null) {
       router.replace('/login')
       return
     }

     if (user === undefined) return // still loading

     try {
       const localSettings = JSON.parse(localStorage.getItem('mandoobi_settings'))
       if (localSettings) setSettings(localSettings)
       
       fetch('/api/storage?key=mandoobi_settings')
         .then(res => res.json())
         .then(s => {
           if (s && !Array.isArray(s)) setSettings(s)
         })
         .catch(e => console.error('Failed to fetch settings:', e))
     } catch (e) {
       console.error('Settings error:', e)
     }
   }, [isCreateMode, user])

  if (isCreateMode) {
    // Show loading spinner while auth state is being determined
    if (user === undefined) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]" dir="rtl">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-bold">جاري التحقق من حسابك...</p>
          </div>
        </div>
      )
    }
    // If not logged in, redirect (also handled in useEffect, this is a safety net)
    if (user === null) {
      router.replace('/login')
      return null
    }
    return (
      <div className="min-h-screen bg-[#f8fafc] pb-20" dir="rtl">
        <Head>
          <title>طلب جديد | Mandoobi</title>
        </Head>
        
        {/* Modern Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-[100] px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
             <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 transition-all text-slate-400">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
             </button>
             <h1 className="text-xl font-black text-slate-900 tracking-tight">إنشاء طلب جديد 🚀</h1>
          </div>
          <div className="hidden md:block">
             <span className="text-xs font-bold text-slate-400">تحتاج مساعدة؟ تواصل مع الدعم</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10">
          <form onSubmit={handleSubmitOrder} className="space-y-8">
            
            {/* Step 1: Type Selection */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-50 animate-slide-up">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">👤</div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">نوع الطلب</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">اختر نوع الخدمة التي ترغب بها</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  {id: 'individual', label: 'توصيل من الباب للباب (أفراد)', subLabel: 'نستلم غرض من شخص ونسلمه لك أو لشخص آخر', icon: '🤝'},
                  // {id: 'other', label: 'خدمة أخرى', subLabel: 'توصيل طلبات عامة', icon: '🏪'}
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOrderType(t.id)}
                    className={`p-6 rounded-3xl border-2 transition-all text-right flex items-center gap-5 relative overflow-hidden group ${
                      orderType === t.id
                        ? 'border-blue-500 bg-blue-50/30'
                        : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all ${
                      orderType === t.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {t.icon}
                    </div>
                    <div>
                      <div className={`text-lg font-black ${orderType === t.id ? 'text-blue-900' : 'text-slate-800'}`}>{t.label}</div>
                      <div className="text-xs font-bold text-slate-400 mt-1">{t.subLabel}</div>
                    </div>
                    {orderType === t.id && (
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Logged-in user info banner */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-50 animate-slide-up" style={{animationDelay: '0.1s'}}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">✅</div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">مسجل الدخول كـ</p>
                  <p className="text-lg font-black text-slate-900">{user?.name || user?.phone}</p>
                </div>
              </div>
            </div>

            {/* Step 3: Source Info */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-50 animate-slide-up" style={{animationDelay: '0.2s'}}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📍</div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">مكان الاستلام</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">من أين سنقوم باستلام الغرض؟</p>
                </div>
              </div>

              <div className="space-y-6">
                <FormInput 
                  label={orderType === 'individual' ? "اسم الشخص (المُرسل)" : "اسم المكان/المطعم"} 
                  placeholder={orderType === 'individual' ? "أدخل اسم الشخص" : "مثال: كنتاكي"} 
                  value={sourceName} 
                  onChange={e=>setSourceName(e.target.value)} 
                />
                
                {orderType === 'individual' && (
                  <div>
                    <FormInput 
                      label="رقم هاتف المُرسل" 
                      placeholder="01xxxxxxxxx" 
                      value={sourcePhone} 
                      onChange={e=>setSourcePhone(e.target.value)}
                      error={sourcePhone && sourcePhone !== 'admin' && (sourcePhone.length !== 11 || !sourcePhone.startsWith('01'))}
                    />
                    {sourcePhone && sourcePhone !== 'admin' && (sourcePhone.length !== 11 || !sourcePhone.startsWith('01')) && (
                      <p className="text-[10px] text-rose-500 font-black mt-2 mr-2">⚠️ يجب أن يتكون من 11 رقم ويبدأ بـ 01</p>
                    )}
                  </div>
                )}

                <FormInput label="عنوان الاستلام بالتفصيل" placeholder="مثال: الفوال، شارع البحر، عمارة رقم 10" value={sourceAddress} onChange={e=>setSourceAddress(e.target.value)} />
                
                {orderType !== 'individual' && (
                  <FormInput label="قيمة الطلب المطلوب دفعها للمكان" placeholder="0.00" type="number" value={serviceAmount} onChange={e=>setServiceAmount(e.target.value)} />
                )}
              </div>
            </div>

            {/* Step 4: Order Details */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-50 animate-slide-up" style={{animationDelay: '0.3s'}}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📝</div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">تفاصيل الطلب</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">اكتب ما تريد توصيله بالضبط</p>
                </div>
              </div>
              
              <textarea 
                value={details} 
                onChange={e=>setDetails(e.target.value)} 
                className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none h-40 text-slate-800" 
                placeholder="مثال: شنطة ملابس، أوراق رسمية، غداء من مطعم كذا..." 
              />
            </div>

            {/* Step 5: Payment */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-50 animate-slide-up" style={{animationDelay: '0.4s'}}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">💳</div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">طريقة الدفع</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">اختر الطريقة المناسبة لك</p>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                  className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl flex items-center justify-between hover:border-amber-500 transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-4">
                    {(() => {
                      const m = [
                        {id: 'cash', label: 'كاش (عند الاستلام)', icon: '💵', color: 'emerald'},
                        {id: 'vodafone_cash', label: 'فودافون كاش', icon: '📱', color: 'rose'},
                        {id: 'instapay', label: 'انستا باي', icon: '🏛️', color: 'indigo'}
                      ].find(x => x.id === paymentMethod) || {label: 'اختر طريقة الدفع', icon: '💳', color: 'slate'}
                      return (
                        <>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-${m.color}-50 text-${m.color}-600 group-hover:scale-110 transition-transform`}>
                            {m.icon}
                          </div>
                          <span className="font-black text-slate-800">{m.label}</span>
                        </>
                      )
                    })()}
                  </div>
                  <div className={`transition-transform duration-300 ${isPaymentDropdownOpen ? 'rotate-180' : ''}`}>
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {isPaymentDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-3xl shadow-2xl z-[150] overflow-hidden animate-slide-up">
                    {[
                      {id: 'cash', label: 'كاش (عند الاستلام)', sub: 'نقداً', icon: '💵', color: 'emerald'},
                      {id: 'vodafone_cash', label: 'فودافون كاش', sub: 'محفظة إلكترونية', icon: '📱', color: 'rose'},
                      {id: 'instapay', label: 'انستا باي', sub: 'تحويل بنكي لحظي', icon: '🏛️', color: 'indigo'}
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id)
                          setIsPaymentDropdownOpen(false)
                        }}
                        className={`w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0 ${
                          paymentMethod === m.id ? 'bg-slate-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-5 text-right">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-${m.color}-50 text-${m.color}-600`}>
                            {m.icon}
                          </div>
                          <div>
                            <div className="font-black text-sm text-slate-800">{m.label}</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">{m.sub}</div>
                          </div>
                        </div>
                        {paymentMethod === m.id && (
                          <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') && (
                <div className="mt-8 p-8 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden group animate-fade-in">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  <div className="relative z-10 text-center">
                    <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-2">رقم التحويل</p>
                    <div className="text-3xl font-black tracking-widest text-[#FF6A00] select-all mb-6">01000469320</div>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                       <label className="block text-[10px] font-black opacity-50 mb-4 uppercase">ارفق صورة التحويل هنا</label>
                       <input type="file" accept="image/*" onChange={handleFile} className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#FF6A00] file:text-white hover:file:bg-[#FF8A3D] cursor-pointer" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Price Summary & Submit - Not Sticky */}
            <div className="mt-16 animate-slide-up" style={{animationDelay: '0.5s'}}>
              <div className="bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/10">
                <div className="flex items-center gap-4 sm:gap-6">
                   <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-400 to-[#FF6A00] rounded-2xl flex items-center justify-center text-3xl shadow-lg border border-white/20">💰</div>
                   <div>
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">تكلفة التوصيل الإجمالية</p>
                     <div className="flex items-baseline gap-2">
                       <span className="text-3xl sm:text-5xl font-black text-white">
                         {(parseFloat(settings.baseFare) + (settings.commissionType === 'percentage' 
                           ? (parseFloat(settings.baseFare) * (parseFloat(settings.commission) / 100))
                           : parseFloat(settings.commission))).toFixed(2)}
                       </span>
                       <span className="text-xs font-bold text-[#FF6A00]">ج.م</span>
                     </div>
                   </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-16 py-5 bg-[#FF6A00] text-white rounded-[1.5rem] sm:rounded-[2rem] font-black text-lg hover:bg-white hover:text-slate-900 transition-all shadow-xl shadow-[#FF6A00]/20 disabled:opacity-50 flex items-center justify-center gap-3 group"
                >
                  {loading ? 'جاري التنفيذ...' : (
                    <>
                      <span>تأكيد الطلب الآن</span>
                      <span className="group-hover:translate-x-[-5px] transition-transform">🚀</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-6 bg-rose-50 border border-rose-100 text-rose-600 rounded-[2rem] text-center font-black text-sm flex items-center justify-center gap-3 shadow-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

          </form>
        </div>
      </div>
    )
  }

  // --- Render Detail View ---
  if(!order) return <div className="p-6 text-center">جاري التحميل...</div>

  const completedAt = order.completedAt?.seconds ? (order.completedAt.seconds * 1000) : (order.completedAt ? new Date(order.completedAt).getTime() : null)
  const diffCompletedMins = completedAt ? (Date.now() - completedAt) / (1000 * 60) : 0
  const isExpiredForGuest = !user && (order.status === 'completed' && diffCompletedMins > 30)

  if (isExpiredForGuest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-xl w-full bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center">
          <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">🔒</div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">انتهت صلاحية التتبع</h1>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            عذراً، هذا الطلب مكتمل منذ أكثر من 30 دقيقة. لأسباب تتعلق بخصوصية البيانات، يتم إيقاف التتبع العام للطلبات المكتملة بعد مرور 30 دقيقة.
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

  const displayPickedUpAt = order.pickedUpAt || (['on_way', 'delivered', 'completed'].includes(order.status) ? order.updatedAt : null);
  const displayCompletedAt = order.completedAt || (order.status === 'completed' ? order.updatedAt : null);

  const calculateDuration = (start, end) => {
    if (!start || !end) return null;
    const s = new Date(start?.seconds ? start.seconds * 1000 : start);
    const e = new Date(end?.seconds ? end.seconds * 1000 : end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    const diff = Math.abs(e - s);
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) return `${hours} ساعة و ${remainingMins} دقيقة`;
    return `${mins} دقيقة`;
  }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-slate-50" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">📝</span>
                محتويات الطلب
              </h3>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-700 font-bold leading-relaxed">
                {order.details}
              </div>
              
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
                      <div className="text-xs text-blue-600 font-bold">وقت الطلب: <span className="text-blue-900">{new Date(order.createdAt?.seconds * 1000 || order.createdAt || Date.now()).toLocaleString('ar-EG')}</span></div>
                      
                      {order.pickedUpAt && (
                        <div className="text-xs text-blue-600 font-bold">وقت الاستلام: <span className="text-blue-900">{new Date(order.pickedUpAt).toLocaleString('ar-EG')}</span></div>
                      )}
                      
                      {order.completedAt && (
                        <div className="text-xs text-blue-600 font-bold">وقت التسليم: <span className="text-blue-900">{new Date(order.completedAt).toLocaleString('ar-EG')}</span></div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">⏰</span>
                مواعيد الطلب
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-xs font-black text-slate-500">وقت الطلب</div>
                  <div className="text-sm font-black text-slate-900">{new Date(order.createdAt?.seconds * 1000 || order.createdAt || Date.now()).toLocaleString('ar-EG')}</div>
                </div>
                
                <div className={`flex justify-between items-center p-4 rounded-2xl border ${displayPickedUpAt ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className={`text-xs font-black ${displayPickedUpAt ? 'text-blue-600' : 'text-slate-400'}`}>وقت الاستلام</div>
                  <div className={`text-sm font-black ${displayPickedUpAt ? 'text-blue-900' : 'text-slate-400'}`}>
                    {displayPickedUpAt ? new Date(displayPickedUpAt).toLocaleString('ar-EG') : 'بانتظار الاستلام...'}
                  </div>
                </div>
                
                <div className={`flex justify-between items-center p-4 rounded-2xl border ${displayCompletedAt ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className={`text-xs font-black ${displayCompletedAt ? 'text-emerald-600' : 'text-slate-400'}`}>وقت التسليم</div>
                  <div className={`text-sm font-black ${displayCompletedAt ? 'text-emerald-900' : 'text-slate-400'}`}>
                    {displayCompletedAt ? new Date(displayCompletedAt).toLocaleString('ar-EG') : 'لم يتم التسليم بعد'}
                  </div>
                </div>

                {displayCompletedAt && (
                  <div className="mt-6 p-6 bg-slate-900 text-white rounded-[1.5rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative z-10 flex justify-between items-center">
                      <div>
                        <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">إجمالي وقت التوصيل</div>
                        <div className="text-xl font-black">{calculateDuration(order.createdAt, displayCompletedAt)}</div>
                      </div>
                      <div className="text-3xl">🏁</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="p-8 bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-600 text-white rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -ml-16 -mt-16 group-hover:bg-white/20 transition-all duration-500"></div>
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">💵</div>
                    <div>
                      <div className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mb-1">طريقة الدفع</div>
                      <div className="text-lg font-black">
                        {order.paymentMethod === 'cash' ? 'كاش (نقداً) 💵' : 
                         order.paymentMethod === 'vodafone_cash' ? 'فودافون كاش 📱' : 'انستا باي 💳'}
                      </div>
                    </div>
                  </div>
                  <div className="text-center sm:text-left pt-6 sm:pt-0 border-t sm:border-t-0 sm:border-r border-white/10 sm:pr-8 flex-1">
                    <div className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mb-1">إجمالي المستحق</div>
                    <div className="flex items-baseline justify-center sm:justify-start gap-2">
                      <span className="text-4xl font-black tracking-tighter">{order.price}</span>
                      <span className="text-xs font-bold opacity-60">ج.م</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">مواقع التوصيل</h3>
              
              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-2 mr-2">📍 نقطة الاستلام (المصدر)</div>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
                    <div className="text-xs font-bold text-slate-700 leading-relaxed">
                      {order.sourceAddress || 'غير محدد'}
                    </div>
                    {(user?.role === 'admin' || user?.uid === order.clientId || user?.uid === order.courierId || order.clientType === 'guest') && (
                      <div className="pt-3 border-t border-blue-100 flex flex-col gap-1">
                        <div className="text-[11px] font-black text-blue-800 flex items-center gap-1">
                          👤 {order.sourceName || 'غير محدد'}
                        </div>
                        <div className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                          📞 {order.sourcePhone || 'غير محدد'}
                        </div>
                        {(user?.uid === order.courierId || user?.role === 'admin') && order.sourcePhone && (
                          <a href={`tel:${order.sourcePhone}`} className="mt-1 w-full py-2 bg-blue-600 text-white rounded-lg text-center text-[10px] font-black">اتصال بالمصدر 📞</a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative h-4 flex items-center justify-center">
                  <div className="w-px h-full bg-slate-200 border-dashed border-l"></div>
                </div>

                <div>
                  <div className="text-[10px] font-black text-emerald-600 uppercase mb-2 mr-2">🏁 نقطة التسليم (العميل)</div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="text-xs font-bold text-slate-700 leading-relaxed">
                      {order.deliveryAddress || order.guestAddress || clientInfo?.address || 'غير محدد'}
                    </div>
                    {(user?.role === 'admin' || user?.uid === order.clientId || user?.uid === order.courierId || order.clientType === 'guest') && (
                      <div className="pt-3 border-t border-emerald-100 flex flex-col gap-1">
                        <div className="text-[11px] font-black text-emerald-800 flex items-center gap-1">
                          👤 {order.clientType === 'guest' ? (order.guestName || 'زائر') : (clientInfo?.name || 'تحميل...')}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          📞 {order.clientType === 'guest' ? (order.guestPhone || 'غير متوفر') : (clientInfo?.phone || 'تحميل...')}
                        </div>
                        {(user?.uid === order.courierId || user?.role === 'admin') && (order.guestPhone || clientInfo?.phone) && (
                          <a href={`tel:${order.clientType === 'guest' ? order.guestPhone : clientInfo?.phone}`} className="mt-1 w-full py-2 bg-emerald-600 text-white rounded-lg text-center text-[10px] font-black">اتصال بالعميل 📞</a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {order.courierId && order.status === 'on_way' && (user?.uid === order.clientId || order.clientType === 'guest' || user?.role === 'admin') && (
              <div className="bg-blue-900 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full -mb-12 -mr-12"></div>
                <h3 className="text-xs font-black text-white/40 uppercase mb-6 tracking-widest flex items-center gap-1 justify-end">
                  <span>معلومات المندوب</span>
                  <span>🛵</span>
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl overflow-hidden">
                    {courierInfo?.profileImage ? <img src={courierInfo.profileImage} className="w-full h-full object-cover" /> : '🛵'}
                  </div>
                  <div>
                    <div className="font-black text-lg flex items-center gap-2">
                      <span>🛵</span>
                      <span>{courierInfo?.name || 'غير محدد'}</span>
                    </div>
                    <div className="text-xs text-white/60 font-bold">المندوب في طريقه إليك</div>
                  </div>
                </div>
                <a 
                  href={`tel:${courierInfo?.phone}`}
                  className="w-full mt-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span>📞</span> اتصال بالمندوب
                </a>
              </div>
            )}
          </div>
        </div>

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

function FormInput({ label, placeholder, value, onChange, type = "text", error = false }) {
  return (
    <div className="w-full">
      <label className="block text-xs font-black text-slate-400 mb-2 mr-2 uppercase tracking-widest">{label}</label>
      <input 
        type={type}
        value={value} 
        onChange={onChange} 
        className={`w-full p-5 bg-slate-50 border ${error ? 'border-rose-300 ring-4 ring-rose-500/10' : 'border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'} rounded-2xl font-bold outline-none transition-all text-slate-800 placeholder:text-slate-300`} 
        placeholder={placeholder} 
      />
    </div>
  )
}

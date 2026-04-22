import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../services/auth'
import { subscribeToOrder, updateOrder } from '../../../services/orders'
import Head from 'next/head'

export default function EditOrder(){
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  
  const [details, setDetails] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [transferImage, setTransferImage] = useState(null)
  const [sourceName, setSourceName] = useState('')
  const [sourcePhone, setSourcePhone] = useState('')
  const [sourceAddress, setSourceAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [orderType, setOrderType] = useState('individual')
  const [serviceAmount, setServiceAmount] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = subscribeToOrder(id, (o) => {
      if (!o) {
        setError('الطلب غير موجود')
        setInitialLoading(false)
        return
      }
      
      // التحقق من الصلاحية
      if (user && o.clientId !== user.uid && user.role !== 'admin') {
        setError('عذراً، لا تملك صلاحية تعديل هذا الطلب')
        setInitialLoading(false)
        return
      }

      // التحقق من الحالة
      if (!['pending', 'accepted'].includes(o.status)) {
        setError('عذراً، لا يمكن تعديل الطلب بعد بدء تجهيزه')
        setInitialLoading(false)
        return
      }

      setDetails(o.details || '')
      setPaymentMethod(o.paymentMethod || 'cash')
      setSourceName(o.sourceName || '')
      setSourcePhone(o.sourcePhone || '')
      setSourceAddress(o.sourceAddress || '')
      setOrderType(o.orderType || 'individual')
      setServiceAmount(o.serviceAmount || '')
      setInitialLoading(false)
    })
    return () => unsub()
  }, [id, user])

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if(!f) return
    setError('')
    setTransferImage(f)
  }

  const submit = async (e) =>{
    e.preventDefault()
    setError('')
    
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
      // إذا كان الدفع إلكتروني، يجب التأكد من وجود صورة
      // سنفترض أن المستخدم قد لا يغير الصورة القديمة، ولكن إذا غير طريقة الدفع يجب رفع صورة
    }
    
    setLoading(true)
    const payload = {
      details,
      paymentMethod,
      sourceName,
      sourcePhone: orderType === 'individual' ? sourcePhone : null,
      sourceAddress,
      orderType,
      serviceAmount: orderType !== 'individual' ? parseFloat(serviceAmount) : null,
    }

    if (transferImage) payload.transferImage = transferImage

    try{
      await updateOrder(id, payload)
      alert('تم تحديث الطلب بنجاح')
      router.push(`/order/${id}`)
    }catch(err){
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) return <div className="min-h-screen flex items-center justify-center font-black">جاري تحميل بيانات الطلب...</div>

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl text-center">
          <div className="text-5xl mb-6">⚠️</div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">خطأ في التعديل</h2>
          <p className="text-slate-500 font-bold mb-8">{error}</p>
          <button onClick={() => router.push('/dashboard/client')} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black transition-all">العودة لطلباتي</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
      <Head>
        <title>تعديل الطلب | Mandoobi</title>
      </Head>
      <form onSubmit={submit} className="w-full max-w-xl p-10 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">✏️</div>
          <h2 className="text-3xl font-black text-slate-900">تعديل طلبك</h2>
          <p className="text-slate-400 font-bold mt-2">تحديث بيانات الطلب رقم #{id?.toString().slice(-5)}</p>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
            <h3 className="text-sm font-black text-slate-800 mb-4">نوع الطلب</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                {id: 'individual', label: 'شخص فردي', subLabel: 'من الباب إلى الباب', icon: '👤'},
                // {id: 'other', label: 'خدمة أخرى', subLabel: 'توصيل طلبات', icon: '🏪'}
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOrderType(t.id)}
                  className={`p-4 rounded-2xl font-black text-[10px] transition-all flex flex-col items-center justify-center ${
                    orderType === t.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-2xl mb-2">{t.icon}</div>
                  <div>{t.label}</div>
                  <div className={`text-[7px] mt-0.5 opacity-60 ${orderType === t.id ? 'text-blue-100' : 'text-slate-400'}`}>
                    {t.subLabel}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 mr-2">تفاصيل الطلب (الأصناف)</label>
            <textarea value={details} onChange={e=>setDetails(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-32" placeholder="ماذا تريد أن تطلب؟" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <h3 className="md:col-span-2 text-sm font-black text-slate-800 mb-2">
              {orderType === 'individual' ? 'ادخل بيانات العميل الي هنستلم منو الطلب و نوصلو ليك لحد مكانك' : 'بيانات المكان المطلوب منه'}
            </h3>
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-400 mb-2 mr-2">
                {orderType === 'individual' ? 'اسم مصدر التوصيل' : 'اسم المكان'}
              </label>
              <input value={sourceName} onChange={e=>setSourceName(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder={orderType === 'individual' ? "اسم الشخص" : "اسم المطعم/المكان"} />
            </div>
            {orderType === 'individual' && (
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-2">هاتف مصدر التوصيل</label>
                <input 
                  value={sourcePhone} 
                  onChange={e=>setSourcePhone(e.target.value)} 
                  className={`w-full p-4 bg-white border ${sourcePhone && sourcePhone.length !== 11 ? 'border-red-300' : 'border-slate-200'} rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all`} 
                  placeholder="01xxxxxxxxx" 
                />
                {sourcePhone && sourcePhone !== 'admin' && (sourcePhone.length !== 11 || !sourcePhone.startsWith('01')) && (
                  <div className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50 animate-fade-in w-fit">
                    <span className="text-[10px]">⚠️</span>
                    <p className="text-[10px] font-black">يجب البدء بـ 01 و11 رقم (حالياً: {sourcePhone.length})</p>
                  </div>
                )}
              </div>
            )}
            {orderType !== 'individual' && (
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-2">المبلغ المطلوب (قيمة الطلب)</label>
                <input type="number" value={serviceAmount} onChange={e=>setServiceAmount(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="0.00" />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-400 mb-2 mr-2">عنوان مصدر التوصيل بالتفصيل</label>
              <input value={sourceAddress} onChange={e=>setSourceAddress(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="المحافظة، المنطقة، الشارع" />
            </div>
          </div>

          <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative">
            <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">💳</span>
              طريقة الدفع
            </h3>
            
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                className="w-full p-5 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all shadow-sm group"
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
                  ▼
                </div>
              </button>

              {isPaymentDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[50] overflow-hidden animate-slide-up">
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
                      className={`w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0 ${
                        paymentMethod === m.id ? `bg-${m.color}-50/50` : ''
                      }`}
                    >
                      <div className="flex items-center gap-4 text-right">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-${m.color}-50 text-${m.color}-600`}>
                          {m.icon}
                        </div>
                        <div>
                          <div className="font-black text-xs text-slate-800">{m.label}</div>
                          <div className="text-[9px] font-bold text-slate-400">{m.sub}</div>
                        </div>
                      </div>
                      {paymentMethod === m.id && <span className={`text-${m.color}-500 font-black`}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(paymentMethod === 'vodafone_cash' || paymentMethod === 'instapay') && (
              <div className="mt-6 p-6 bg-white rounded-3xl border-2 border-dashed border-blue-200 animate-pulse">
                <div className="text-center">
                  <div className="text-[10px] font-black text-blue-500 uppercase mb-2 tracking-widest">رقم التحويل المطلوب</div>
                  <div className="text-2xl font-black text-slate-900 select-all tracking-wider">01000469320</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-2">يرجى تحويل المبلغ ثم إرفاق صورة التحويل بالأسفل</div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50">
                  <label className="block text-[10px] font-black text-slate-400 mb-2 mr-2 uppercase tracking-widest">تحديث صورة التحويل (اختياري)</label>
                  <input type="file" accept="image/*" onChange={handleFile} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات 💾'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black text-lg hover:bg-slate-200 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

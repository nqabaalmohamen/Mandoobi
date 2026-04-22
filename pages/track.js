import { useState } from 'react'
import { useRouter } from 'next/router'
import { getOrder } from '../services/orders'
import { useAuth } from '../services/auth'

export default function TrackOrder() {
  const { user } = useAuth()
  const router = useRouter()
  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!user || user.role !== 'client') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-xl w-full bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner">🚫</div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">وصول غير مصرح به</h1>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            عذراً، خاصية البحث عن الطلبات وتتبعها متاحة للعملاء المسجلين فقط. إذا قمت بإنشاء طلب بدون تسجيل، يمكنك تتبعه من خلال الرابط الذي ظهر لك عند إتمام الطلب.
          </p>
          <a href="/" className="inline-block px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all hover:bg-black">
            العودة للرئيسية
          </a>
        </div>
      </div>
    )
  }

  const handleTrack = async (e) => {
    e.preventDefault()
    if (!orderId) return
    
    setLoading(true)
    setError('')
    
    try {
      const order = await getOrder(orderId)
      
      // منطق الخصوصية المحدث:
      // 1. إذا كان العميل مسجلاً -> يظهر الطلب دائماً
      // 2. إذا لم يكن مسجلاً -> يظهر الطلب فقط إذا لم يكتمل ولم يمر عليه 30 دقيقة
      
      const createdAt = order.createdAt?.seconds ? (order.createdAt.seconds * 1000) : new Date(order.createdAt).getTime()
      const diffMins = (Date.now() - createdAt) / (1000 * 60)
      
      if (!user) {
        if (order.status === 'completed') {
          setError('عذراً، هذا الطلب مكتمل ولا يمكن عرضه لغير المسجلين.')
          return
        }
        if (diffMins > 30) {
          setError('عذراً، هذا الطلب مر عليه أكثر من 30 دقيقة ولا يمكن عرضه لغير المسجلين.')
          return
        }
      }
      
      router.push(`/order/${orderId}`)
    } catch (err) {
      setError('رقم الطلب غير صحيح أو غير موجود.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-xl w-full bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center">
        <div className="w-20 h-20 bg-orange-50 text-[#FF6A00] rounded-full flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner">🔍</div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">تتبع طلبك الآن</h1>
        <p className="text-slate-500 font-medium mb-10 leading-relaxed">
          أدخل رقم الطلب الخاص بك لمتابعة حالته لحظة بلحظة.
        </p>

        <form onSubmit={handleTrack} className="space-y-6">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="مثال: 123" 
              className="w-full h-16 px-8 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-[#FF6A00] focus:bg-white outline-none text-xl font-black transition-all text-center"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF6A00] transition-colors">#</span>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl ${
              loading 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-[#FF6A00] text-white shadow-[#FF6A00]/20 hover:bg-[#FF8A3D] hover:scale-[1.02] active:scale-95'
            }`}
          >
            {loading ? 'جاري البحث...' : 'استعلام عن الطلب 🚀'}
          </button>
        </form>

        {!user && (
          <div className="mt-10 pt-8 border-t border-slate-50">
            <p className="text-xs text-slate-400 font-bold mb-4 italic">تنبيه: لأسباب أمنية، يتم إخفاء بيانات الطلبات المكتملة لغير المسجلين.</p>
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm text-slate-500 font-medium">هل تريد سجل كامل لطلباتك؟</span>
              <a href="/register" className="text-sm font-black text-[#FF6A00] hover:underline">أنشئ حساباً الآن</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

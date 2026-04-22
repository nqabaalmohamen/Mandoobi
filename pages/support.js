import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Support() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    orderId: '',
    type: 'complaint',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    if (formData.phone !== 'admin' && (formData.phone.length !== 11 || !/^\d+$/.test(formData.phone) || !formData.phone.startsWith('01'))) {
      alert('يجب أن يبدأ رقم الهاتف بـ 01 ويتكون من 11 رقم بالضبط')
      setLoading(false)
      return
    }

    try {
      const supportKey = 'mandoobi_support_requests'
      const res = await fetch(`/api/storage?key=${supportKey}`)
      const existingRequests = await res.json()
      
      const newRequest = {
        ...formData,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        status: 'pending'
      }
      
      const updatedRequests = [newRequest, ...existingRequests]
      
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: supportKey, value: updatedRequests })
      })
      
      window.dispatchEvent(new Event('mandoobi_data_changed'))
      setSubmitted(true)
    } catch (err) {
      console.error('Failed to submit support request:', err)
      alert('حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-hidden" dir="rtl">
      <Head>
        <title>مركز المساعدة والشكاوى | Mandoobi</title>
      </Head>

      {/* Decorative Background Elements */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -mr-64 -mt-64 z-0"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-[#FF6A00]/5 rounded-full blur-[120px] -ml-64 -mb-64 z-0"></div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 lg:py-24">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-24">
          <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-blue-100 animate-fade-in">
            نحن هنا من أجلك
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 mb-8 leading-tight">
            كيف يمكننا <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6A00] to-[#FF8A3D]">مساعدتك اليوم؟</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">
            فريق الدعم الفني في مندو بي متاح دائماً للرد على استفساراتكم وحل مشكلاتكم بأسرع وقت ممكن.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Form Section */}
          <div className="">
            <div className="bg-white p-8 lg:p-12 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
              {submitted ? (
                <div className="text-center py-12 animate-slide-up">
                  <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">✅</div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">تم استلام طلبك!</h2>
                  <p className="text-slate-500 font-medium max-w-md mx-auto mb-10 leading-relaxed">
                    شكراً لتواصلك معنا. لقد تم إرسال طلبك بنجاح، وسيقوم فريقنا بمراجعته والتواصل معك في أقرب وقت ممكن.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                      onClick={() => setSubmitted(false)}
                      className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all"
                    >
                      إرسال رسالة أخرى
                    </button>
                    <button 
                      onClick={() => router.push('/')}
                      className="px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                    >
                      العودة للرئيسية
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الاسم بالكامل</label>
                      <input 
                        required
                        type="text"
                        placeholder="ما هو اسمك؟"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-bold"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">رقم الهاتف</label>
                      <input 
                        required
                        type="tel"
                        placeholder="01xxxxxxxxx"
                        className={`w-full px-5 py-3 sm:px-6 sm:py-4 bg-slate-50 border ${formData.phone && formData.phone.length !== 11 ? 'border-red-300' : 'border-slate-100'} rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/20 focus:border-[#FF6A00] transition-all text-sm sm:text-base`}
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                      {formData.phone && formData.phone !== 'admin' && (formData.phone.length !== 11 || !formData.phone.startsWith('01')) && (
                        <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50 animate-fade-in">
                          <span className="text-[10px]">⚠️</span>
                          <p className="text-[10px] font-black">يجب البدء بـ 01 و11 رقم (حالياً: {formData.phone.length})</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">رقم الطلب (اختياري)</label>
                      <input 
                        type="text"
                        placeholder="#12345"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-bold text-center"
                        value={formData.orderId}
                        onChange={(e) => setFormData({...formData, orderId: e.target.value})}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">نوع التواصل</label>
                      <div className="relative">
                        <select 
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-black appearance-none"
                          value={formData.type}
                          onChange={(e) => setFormData({...formData, type: e.target.value})}
                        >
                          <option value="complaint">تقديم شكوى ⚠️</option>
                          <option value="inquiry">استفسار عام 💬</option>
                          <option value="suggestion">اقتراح تحسين ✨</option>
                          <option value="other">أخرى ❓</option>
                        </select>
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">تفاصيل الرسالة</label>
                    <textarea 
                      required
                      rows="5"
                      placeholder="اشرح لنا المشكلة أو الاستفسار بالتفصيل..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none font-bold resize-none"
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                    ></textarea>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-gradient-to-r from-[#FF6A00] to-[#FF8A3D] text-white rounded-[2rem] font-black text-lg shadow-xl shadow-[#FF6A00]/20 hover:shadow-2xl hover:shadow-[#FF6A00]/30 hover:-translate-y-1 transition-all disabled:opacity-50 relative overflow-hidden group"
                  >
                    <span className="relative z-10">{loading ? 'جاري الإرسال...' : 'إرسال الطلب الآن 🚀'}</span>
                    <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

import { useState } from 'react'
import { useAuth } from '../services/auth'
import { useRouter } from 'next/router'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeUser, setWelcomeUser] = useState(null)
  const { signIn, requestPasswordReset } = useAuth()
  const router = useRouter()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const isPhoneAttempt = /^\d+$/.test(phone);
      if (isPhoneAttempt && (phone.length !== 11 || !phone.startsWith('01'))) {
        setError('تنبيه: يجب أن يبدأ رقم الهاتف بـ 01 ويتكون من 11 رقم')
        // We don't return here to allow legacy/admin accounts to login
      }
      await signIn(phone, password)
      const stored = localStorage.getItem('mandoobi_user')
      if(stored) {
        const u = JSON.parse(stored)
        const dest = u.role === 'admin' ? '/dashboard/admin' : u.role === 'courier' ? '/dashboard/courier' : '/dashboard/client'
        // Show welcome screen
        setWelcomeUser({ name: u.name, role: u.role, dest })
        setTimeout(() => router.push(dest), 2500)
      } else {
        router.push('/dashboard/client')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!phone) {
      setError('يرجى إدخال رقم الهاتف أولاً لإرسال طلب استعادة كلمة المرور')
      return
    }
    setError('')
    try {
      await requestPasswordReset(phone)
      setSuccess('تم ارسال طلب استعادة كلمة السر و سوف يتم التواصل معك في اقرب وقت')
    } catch (err) {
      setError('فشل في إرسال الطلب، يرجى المحاولة لاحقاً')
    }
  }

  // Welcome screen after successful login
  if (welcomeUser) {
    const roleLabel = welcomeUser.role === 'admin' ? 'المدير' : welcomeUser.role === 'courier' ? 'مندوب التوصيل' : 'العميل'
    const roleIcon = welcomeUser.role === 'admin' ? '👑' : welcomeUser.role === 'courier' ? '🛵' : '👤'
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900" dir="rtl">
        <style>{`
          @keyframes welcome-pop {
            0% { opacity: 0; transform: scale(0.8) translateY(30px); }
            60% { transform: scale(1.05) translateY(-5px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes ring-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255,106,0,0.5); }
            50% { box-shadow: 0 0 0 20px rgba(255,106,0,0); }
          }
          @keyframes progress-bar {
            from { width: 0%; }
            to { width: 100%; }
          }
          .welcome-card { animation: welcome-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .ring-pulse { animation: ring-pulse 1.5s ease-in-out infinite; }
          .progress-bar { animation: progress-bar 2.5s linear forwards; }
        `}</style>
        <div className="welcome-card text-center px-8 py-12 max-w-sm w-full">
          {/* Icon */}
          <div className="relative inline-block mb-8">
            <div className="ring-pulse w-28 h-28 bg-gradient-to-br from-[#FF6A00] to-orange-400 rounded-full flex items-center justify-center text-5xl mx-auto shadow-2xl shadow-[#FF6A00]/40">
              {roleIcon}
            </div>
            <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white text-lg shadow-lg border-4 border-slate-900">
              ✓
            </div>
          </div>

          {/* Text */}
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-3">أهلاً وسهلاً</p>
          <h1 className="text-4xl font-black text-white mb-2">{welcomeUser.name || 'مرحباً بك'} 👋</h1>
          <p className="text-slate-400 font-bold text-base mb-8">
            تم تسجيل دخولك بنجاح كـ <span className="text-[#FF6A00] font-black">{roleLabel}</span>
          </p>

          {/* Progress bar */}
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div className="progress-bar h-full bg-gradient-to-r from-[#FF6A00] to-orange-300 rounded-full"></div>
          </div>
          <p className="text-slate-500 text-xs font-bold mt-4">جاري التحويل للوحة التحكم...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-md p-10 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">🔑</div>
          <h2 className="text-3xl font-black text-slate-900">تسجيل الدخول</h2>
          <p className="text-slate-400 font-bold mt-2">مرحباً بك مجدداً في مندو بي</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-bold flex items-center gap-3 animate-shake">
            <span className="text-xl">⚠️</span>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-sm font-bold flex items-center gap-3">
            <span className="text-xl">✅</span>
            {success}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-400 mb-2 mr-2">رقم الهاتف أو اسم المستخدم</label>
            <input 
              value={phone} 
              onChange={e=>setPhone(e.target.value)} 
              className={`w-full p-4 bg-slate-50 border ${phone && phone.length !== 11 ? 'border-red-300' : 'border-slate-100'} rounded-2xl font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none`} 
              placeholder="أدخل رقم الهاتف"
              autoComplete="off" 
            />
            {phone && /^\d+$/.test(phone) && (phone.length !== 11 || !phone.startsWith('01')) && (
              <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50 animate-fade-in">
                <span className="text-[10px]">⚠️</span>
                <p className="text-[10px] font-black">يجب البدء بـ 01 و11 رقم (حالياً: {phone.length})</p>
              </div>
            )}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2 mr-2">
              <label className="block text-xs font-black text-slate-400">كلمة المرور</label>
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-black text-blue-600 hover:underline"
              >
                نسيت كلمة المرور؟
              </button>
            </div>
            <input 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none" 
              placeholder="••••••••"
              autoComplete="current-password" 
            />
          </div>

          <button 
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-lg ${
              loading 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-slate-900 text-white hover:bg-black hover:-translate-y-1 active:scale-95 shadow-slate-200'
            }`}
          >
            {loading ? 'جاري التحقق...' : 'دخول للمنصة 🚀'}
          </button>
        </div>

        <div className="mt-10 text-center">
          <p className="text-slate-500 font-medium">ليس لديك حساب؟</p>
          <a href="/register" className="text-blue-600 font-black hover:underline mt-1 inline-block">إنشاء حساب جديد الآن</a>
        </div>
      </form>
    </div>
  )
}

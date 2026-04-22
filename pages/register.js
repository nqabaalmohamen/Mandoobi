import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../services/auth'
import Head from 'next/head'

export default function Register(){
  const [role, setRole] = useState('client')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [idFront, setIdFront] = useState(null)
  const [idBack, setIdBack] = useState(null)
  const [profileImage, setProfileImage] = useState(null)
  const [vehicleType, setVehicleType] = useState('motorcycle')
  const [licenseImage, setLicenseImage] = useState(null)
  const [vehicleImage, setVehicleImage] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeUser, setWelcomeUser] = useState(null)
  const { signUp } = useAuth()
  const router = useRouter()

  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFile = async (e, setter)=>{
    const f = e.target.files[0]
    if(!f) return
    setError('')
    try {
      const b64 = await compressImage(f)
      setter(b64)
    } catch (err) {
      setError('خطأ في معالجة الصورة: ' + err.message)
    }
  }

  const submit = async (e) =>{
    e.preventDefault()
    setError('')
    setLoading(true)
    try{
      // تجهيز البيانات الخاصة بالمناديب إذا تم اختيار هذا النوع
      const userData = { name, phone, address, password, role };
      
      if (role === 'courier') {
        userData.courierData = {
          vehicleType,
          nationalId,
          idFront,
          idBack,
          profileImage,
          licenseImage,
          vehicleImage
        };
      }
      
      if (phone.length !== 11 || !/^\d+$/.test(phone)) {
        setError('يجب أن يتكون رقم الهاتف من 11 رقم بالضبط')
        setLoading(false)
        return
      }

      await signUp(userData)
      // Show welcome screen then redirect to appropriate dashboard
      const dest = role === 'courier' ? '/dashboard/courier' : '/dashboard/client'
      setWelcomeUser({ name, role, dest })
      setTimeout(() => router.push(dest), 2500)
    }catch(err){
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Welcome screen after successful registration
  if (welcomeUser) {
    const roleLabel = welcomeUser.role === 'courier' ? 'مندوب التوصيل' : 'العميل'
    const roleIcon = welcomeUser.role === 'courier' ? '🛵' : '👤'
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
            <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg border-4 border-slate-900">
              ✨
            </div>
          </div>

          {/* Text */}
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-3">مرحباً بك في عائلة مندوبي!</p>
          <h1 className="text-4xl font-black text-white mb-2">{welcomeUser.name} 👋</h1>
          <p className="text-slate-400 font-bold text-base mb-2">
            تم إنشاء حسابك بنجاح كـ <span className="text-[#FF6A00] font-black">{roleLabel}</span>
          </p>
          <p className="text-slate-500 text-sm font-bold mb-8">نتمنى لك تجربة رائعة معنا ✨</p>

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <Head>
        <title>إنشاء حساب جديد | مندوبي</title>
      </Head>

      <div className="w-full max-w-2xl">
        <form onSubmit={submit} className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden transition-all">
          {/* Header Section */}
          <div className="bg-slate-900 p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner border border-white/20">✨</div>
              <h2 className="text-4xl font-black text-white tracking-tight">ابدأ رحلتك معنا</h2>
              <p className="text-slate-400 font-bold mt-3 text-lg">انضم الآن إلى عائلة مندوبي واكتشف خدماتنا المميزة</p>
            </div>
          </div>

          <div className="p-10 space-y-10">
            {error && (
              <div className="p-5 bg-rose-50 border-2 border-rose-100 text-rose-600 rounded-3xl text-sm font-bold flex items-center gap-4 animate-shake">
                <span className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center text-xl shrink-0">⚠️</span>
                {error}
              </div>
            )}

            {/* Role Selection Toggle */}
            <div className="space-y-4">
              <label className="block text-sm font-black text-slate-800 mr-2">اختار نوع الحساب</label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'client', label: 'عميل', desc: 'أريد طلب خدمات توصيل', icon: '👤' },
                  { id: 'courier', label: 'مندوب', desc: 'أريد العمل كمندوب توصيل', icon: '🏍️' }
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`p-6 rounded-[2.5rem] border-2 text-right transition-all duration-300 relative overflow-hidden group ${
                      role === r.id 
                        ? 'border-orange-500 bg-orange-50/50 ring-4 ring-orange-500/10' 
                        : 'border-slate-100 hover:border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-all duration-300 ${
                      role === r.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                      {r.icon}
                    </div>
                    <div className={`font-black text-xl mb-1 ${role === r.id ? 'text-orange-900' : 'text-slate-800'}`}>{r.label}</div>
                    <div className="text-xs font-bold text-slate-500">{r.desc}</div>
                    
                    {role === r.id && (
                      <div className="absolute top-4 left-4 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg animate-scale-up">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-slate-400 mb-2 mr-4 uppercase tracking-widest">الاسم بالكامل</label>
                <div className="relative">
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-30">👤</span>
                  <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-5 pr-14 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-bold focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all placeholder:text-slate-300" placeholder="أدخل اسمك الثلاثي" autoComplete="off" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-4 uppercase tracking-widest">رقم الهاتف</label>
                <div className="relative">
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-30">📱</span>
                  <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-5 pr-14 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-bold focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all placeholder:text-slate-300" placeholder="01xxxxxxxxx" autoComplete="off" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-4 uppercase tracking-widest">العنوان</label>
                <div className="relative">
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-30">📍</span>
                  <input value={address} onChange={e=>setAddress(e.target.value)} className="w-full p-5 pr-14 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-bold focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all placeholder:text-slate-300" placeholder="المحافظة، الحي، الشارع" autoComplete="off" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 mr-4 uppercase tracking-widest">كلمة المرور</label>
                <div className="relative">
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-30">🔑</span>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-5 pr-14 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-bold focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all placeholder:text-slate-300" placeholder="••••••••" autoComplete="new-password" />
                </div>
              </div>
              
              {role === 'courier' && (
                <div className="md:col-span-2 space-y-8 pt-4">
                  <div className="p-8 bg-blue-50/50 border-2 border-blue-100 rounded-[3rem] space-y-6">
                    <h3 className="text-lg font-black text-blue-900 flex items-center gap-3">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">🛵</span>
                      بيانات العمل كمندوب
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-black text-blue-400 mb-2 mr-2">رقم البطاقة (14 رقم)</label>
                        <div className="relative">
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-30">💳</span>
                          <input 
                            value={nationalId} 
                            onChange={e=>setNationalId(e.target.value)} 
                            className="w-full p-4 pr-14 bg-white border-2 border-blue-100 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" 
                            placeholder="299xxxxxxxxxxx" 
                            maxLength={14}
                          />
                        </div>
                      </div>

                      <label className="block text-xs font-black text-blue-400 mr-2">نوع المركبة</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'motorcycle', label: 'موتوسيكل', icon: '🏍️' },
                          { id: 'scooter', label: 'اسكوتر', icon: '🛵' },
                          { id: 'bicycle', label: 'عجلة', icon: '🚲' }
                        ].map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVehicleType(v.id)}
                            className={`p-4 rounded-2xl border-2 font-bold transition-all ${
                              vehicleType === v.id 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/30' 
                                : 'bg-white text-blue-900 border-blue-100 hover:border-blue-200'
                            }`}
                          >
                            <div className="text-2xl mb-1">{v.icon}</div>
                            <div className="text-[10px]">{v.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                      <ImageUpload label="صورة الرقم القومي (أمام)" value={idFront} onChange={(e) => handleFile(e, setIdFront)} />
                      <ImageUpload label="صورة الرقم القومي (خلف)" value={idBack} onChange={(e) => handleFile(e, setIdBack)} />
                      <ImageUpload label="الصورة الشخصية" value={profileImage} onChange={(e) => handleFile(e, setProfileImage)} />
                      <ImageUpload label="صورة المركبة" value={vehicleImage} onChange={(e) => handleFile(e, setVehicleImage)} />
                      {vehicleType === 'motorcycle' && (
                        <div className="sm:col-span-2">
                          <ImageUpload label="صورة رخصة القيادة" value={licenseImage} onChange={(e) => handleFile(e, setLicenseImage)} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="pt-4">
              <button 
                disabled={loading}
                className={`w-full py-6 rounded-[2rem] font-black text-xl transition-all shadow-2xl relative overflow-hidden group ${
                  loading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-orange-500 text-white hover:bg-orange-600 hover:-translate-y-1 active:scale-95 shadow-orange-500/40'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      جاري إنشاء الحساب...
                    </>
                  ) : 'إنشاء حساب الآن ✨'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
              </button>

              <div className="mt-8 text-center bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-slate-500 font-bold">لديك حساب بالفعل؟</p>
                <a href="/login" className="text-orange-600 font-black hover:text-orange-700 transition-colors mt-1 inline-block text-lg">تسجيل الدخول الآن</a>
              </div>
            </div>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out infinite;
        }
        @keyframes scale-up {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        .animate-scale-up {
          animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  )
}

function ImageUpload({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black text-slate-400 mb-1 mr-2 uppercase tracking-tighter">{label}</label>
      <div className={`relative h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer ${
        value ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
      }`}>
        <input type="file" accept="image/*" onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white font-black text-xs">تغيير الصورة</span>
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            <div className="text-2xl mb-1 opacity-40">📸</div>
            <div className="text-[10px] font-bold text-slate-400">اضغط للرفع</div>
          </div>
        )}
      </div>
    </div>
  )
}

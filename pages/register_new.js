import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../services/auth'

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
      const userData = { name, phone, address, password, role: role === 'delegate' ? 'courier' : 'client' };

      if (role === 'delegate') {
        userData.courierData = {
          vehicleType,
          idFront,
          idBack,
          profileImage,
          licenseImage,
          vehicleImage,
          nationalId
        };
      }

      const isPhoneAttempt = /^\d+$/.test(phone);
      if (isPhoneAttempt && (phone.length !== 11 || !phone.startsWith('01'))) {
        setError('يجب أن يبدأ رقم الهاتف بـ 01 ويتكون من 11 رقم بالضبط')
        setLoading(false)
        return
      }

      await signUp(userData)
      // التوجيه إلى لوحة التحكم المناسبة لنوع الحساب
      router.push(role === 'delegate' ? '/dashboard/courier' : '/dashboard/client')
    }catch(err){
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6" dir="rtl">
      <form onSubmit={submit} className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-center">
          <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            <span className="text-white">✨</span>
          </div>
          <h2 className="text-3xl font-bold text-white">إنشاء حساب جديد</h2>
          <p className="text-orange-100 font-medium mt-2">انضم الآن إلى عائلة مندوبي</p>
        </div>

        {/* Main Content */}
        <div className="p-8">
          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium flex items-center gap-3 animate-shake">
              <span className="text-lg">⚠️</span>
              {error}
            </div>
          )}

          {/* Account Type Selection */}
          <div className="mb-10">
            <h3 className="text-lg font-bold text-slate-700 mb-4">اختر نوع حسابك</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center ${
                  role === 'client' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">👤</span>
                </div>
                <span className="text-lg font-bold text-slate-700">عميل</span>
                <p className="text-sm text-slate-500 mt-1 text-center">طلب توصيل للمنتجات</p>
              </button>

              <button
                type="button"
                onClick={() => setRole('delegate')}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center ${
                  role === 'delegate' 
                    ? 'border-orange-500 bg-orange-50 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">🛵</span>
                </div>
                <span className="text-lg font-bold text-slate-700">مندوب</span>
                <p className="text-sm text-slate-500 mt-1 text-center">العمل كمندوب توصيل</p>
              </button>
            </div>
          </div>

          {/* Basic Information Section */}
          <div className="mb-10">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
              <span className="mr-2">📝</span>
              المعلومات الأساسية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">الاسم بالكامل</label>
                <div className="relative">
                  <input 
                    value={name} 
                    onChange={e=>setName(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" 
                    placeholder="أدخل اسمك الكامل" 
                    autoComplete="off" 
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">👤</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">رقم الهاتف</label>
                <div className="relative">
                  <input 
                    value={phone} 
                    onChange={e=>setPhone(e.target.value)} 
                    className={`w-full p-4 bg-slate-50 border ${phone && phone.length !== 11 ? 'border-red-300' : 'border-slate-200'} rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all`} 
                    placeholder="01xxxxxxxxx" 
                    autoComplete="off" 
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">📱</span>
                </div>
                {phone && /^\d+$/.test(phone) && (phone.length !== 11 || !phone.startsWith('01')) && (
                  <div className="flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/50 animate-fade-in">
                    <span className="text-[10px]">⚠️</span>
                    <p className="text-[10px] font-black">يجب البدء بـ 01 و11 رقم (حالياً: {phone.length})</p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-2">العنوان</label>
                <div className="relative">
                  <input 
                    value={address} 
                    onChange={e=>setAddress(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" 
                    placeholder="العنوان بالتفصيل" 
                    autoComplete="off" 
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">📍</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delegate Specific Fields */}
          {role === 'delegate' && (
            <div className="mb-10">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
                <span className="mr-2">🛵</span>
                بيانات المندوب
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">نوع المركبة</label>
                  <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                    <option value="motorcycle">موتوسيكل</option>
                    <option value="scooter">اسكوتر</option>
                    <option value="bicycle">عجلة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">الرقم القومي</label>
                  <input 
                    value={nationalId} 
                    onChange={e=>setNationalId(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" 
                    placeholder="أدخل الرقم القومي" 
                    autoComplete="off" 
                  />
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-md font-bold text-slate-700 mb-4">رفع المستندات المطلوبة</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">صورة الرقم القومي (الأمامية)</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
                      <input type="file" accept="image/*" onChange={(e) => handleFile(e, setIdFront)} className="hidden" id="id-front" />
                      <label htmlFor="id-front" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-3xl text-slate-400 mb-2">📄</span>
                          <span className="text-sm font-medium text-slate-600">اختر ملف</span>
                          <span className="text-xs text-slate-400 mt-1">JPG, PNG, GIF</span>
                        </div>
                      </label>
                      {idFront && (
                        <div className="mt-4">
                          <img src={idFront} alt="الرقم القومي الأمامي" className="max-h-32 mx-auto rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => setIdFront(null)} className="mt-2 text-sm text-red-500 hover:text-red-700">حذف الصورة</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">صورة الرقم القومي (الخلفية)</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
                      <input type="file" accept="image/*" onChange={(e) => handleFile(e, setIdBack)} className="hidden" id="id-back" />
                      <label htmlFor="id-back" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-3xl text-slate-400 mb-2">📄</span>
                          <span className="text-sm font-medium text-slate-600">اختر ملف</span>
                          <span className="text-xs text-slate-400 mt-1">JPG, PNG, GIF</span>
                        </div>
                      </label>
                      {idBack && (
                        <div className="mt-4">
                          <img src={idBack} alt="الرقم القومي الخلفي" className="max-h-32 mx-auto rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => setIdBack(null)} className="mt-2 text-sm text-red-500 hover:text-red-700">حذف الصورة</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">الصورة الشخصية</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
                      <input type="file" accept="image/*" onChange={(e) => handleFile(e, setProfileImage)} className="hidden" id="profile" />
                      <label htmlFor="profile" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-3xl text-slate-400 mb-2">👤</span>
                          <span className="text-sm font-medium text-slate-600">اختر ملف</span>
                          <span className="text-xs text-slate-400 mt-1">JPG, PNG, GIF</span>
                        </div>
                      </label>
                      {profileImage && (
                        <div className="mt-4">
                          <img src={profileImage} alt="الصورة الشخصية" className="max-h-32 mx-auto rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => setProfileImage(null)} className="mt-2 text-sm text-red-500 hover:text-red-700">حذف الصورة</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* License Image for motorcycle only */}
                  {vehicleType === 'motorcycle' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">رخصة القيادة</label>
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
                        <input type="file" accept="image/*" onChange={(e) => handleFile(e, setLicenseImage)} className="hidden" id="license" />
                        <label htmlFor="license" className="cursor-pointer">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-3xl text-slate-400 mb-2">📜</span>
                            <span className="text-sm font-medium text-slate-600">اختر ملف</span>
                            <span className="text-xs text-slate-400 mt-1">JPG, PNG, GIF</span>
                          </div>
                        </label>
                        {licenseImage && (
                          <div className="mt-4">
                            <img src={licenseImage} alt="رخصة القيادة" className="max-h-32 mx-auto rounded-lg border border-slate-200" />
                            <button type="button" onClick={() => setLicenseImage(null)} className="mt-2 text-sm text-red-500 hover:text-red-700">حذف الصورة</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">صورة المركبة</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
                      <input type="file" accept="image/*" onChange={(e) => handleFile(e, setVehicleImage)} className="hidden" id="vehicle" />
                      <label htmlFor="vehicle" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-3xl text-slate-400 mb-2">🛵</span>
                          <span className="text-sm font-medium text-slate-600">اختر ملف</span>
                          <span className="text-xs text-slate-400 mt-1">JPG, PNG, GIF</span>
                        </div>
                      </label>
                      {vehicleImage && (
                        <div className="mt-4">
                          <img src={vehicleImage} alt="صورة المركبة" className="max-h-32 mx-auto rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => setVehicleImage(null)} className="mt-2 text-sm text-red-500 hover:text-red-700">حذف الصورة</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Password Section */}
          <div className="mb-10">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
              <span className="mr-2">🔒</span>
              كلمة المرور
            </h3>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">كلمة المرور</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" 
                  placeholder="أدخل كلمة المرور" 
                  autoComplete="off" 
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">🔒</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mb-8">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-md transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  جاري المعالجة...
                </>
              ) : (
                <>
                  <span className="mr-2">✨</span>
                  إنشاء حساب
                </>
              )}
            </button>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-slate-500 font-medium">لديك حساب بالفعل؟</p>
            <a href="/login" className="text-orange-600 font-bold hover:underline mt-1 inline-block">تسجيل الدخول الآن</a>
          </div>
        </div>
      </form>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useAuth, subscribeToData } from '../services/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'

export default function MaintenanceGuard({ children }) {
  const { user } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState(null)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const unsub = subscribeToData('mandoobi_settings', (data) => {
      setSettings(data)
      setIsLoaded(true)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!settings?.maintenanceMode || !settings?.maintenanceEndTime) return

    const timer = setInterval(() => {
      const end = new Date(settings.maintenanceEndTime).getTime()
      const now = new Date().getTime()
      const distance = end - now

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds })
    }, 1000)

    return () => clearInterval(timer)
  }, [settings])

  // Don't block page rendering while loading settings
  // Show maintenance screen only after confirmed settings are loaded

  const isAdmin = user?.role === 'admin'
  const isLoginPage = router.pathname === '/login'
  const isMaintenance = settings?.maintenanceMode && !isAdmin && !isLoginPage

  if (isMaintenance) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-white overflow-hidden relative" dir="rtl">
        {/* Animated Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center space-y-8"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex items-center justify-center relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
              <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              النظام قيد التحديث
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
              نعمل حالياً على تحسين تجربتكم وإضافة مميزات جديدة. سنعود للعمل قريباً جداً.
            </p>
          </div>

          {/* Countdown */}
          <div className="grid grid-cols-4 gap-3 md:gap-6 max-w-xl mx-auto">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
              <div className="text-2xl md:text-4xl font-mono font-bold text-blue-400">{String(timeLeft.days).padStart(2, '0')}</div>
              <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mt-1">يوم</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
              <div className="text-2xl md:text-4xl font-mono font-bold text-purple-400">{String(timeLeft.hours).padStart(2, '0')}</div>
              <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mt-1">ساعة</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
              <div className="text-2xl md:text-4xl font-mono font-bold text-pink-400">{String(timeLeft.minutes).padStart(2, '0')}</div>
              <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mt-1">دقيقة</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
              <div className="text-2xl md:text-4xl font-mono font-bold text-orange-400">{String(timeLeft.seconds).padStart(2, '0')}</div>
              <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest mt-1">ثانية</div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="pt-8 border-t border-white/5 space-y-4">
            <div className="flex items-center justify-center space-x-2 space-x-reverse text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>فريق التطوير يعمل الآن على التحديثات</span>
            </div>
            
            {/* Admin Login Link */}
            <div className="flex justify-center">
              <button 
                onClick={() => router.push('/login')}
                className="text-xs text-gray-600 hover:text-blue-400 transition-colors flex items-center gap-1"
              >
                <span>🔑</span>
                <span>دخول الإدارة</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      {settings?.maintenanceMode && isAdmin && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-rose-600 text-white text-[10px] md:text-xs font-bold py-1 px-4 text-center shadow-lg flex items-center justify-center gap-2">
          <span className="animate-pulse">⚠️</span>
          <span>وضع الصيانة مفعل - الموقع مخفي عن العامة</span>
          <button 
            onClick={() => router.push('/dashboard/admin?tab=settings')}
            className="underline hover:text-white/80 transition ml-2"
          >
            الإعدادات
          </button>
        </div>
      )}
      {children}
    </>
  )
}

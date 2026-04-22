import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../services/auth'

export default function CourierSidebar({ 
  isOpen, 
  setIsOpen, 
  activeTab, 
  setActiveTab, 
  isOnline, 
  toggleOnlineStatus 
}) {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const tabs = [
    { id: 'available', label: 'طلبات متاحة', icon: '🌍' },
    { id: 'active', label: 'طلباتي النشطة', icon: '🛵' },
    { id: 'history', label: 'سجل الطلبات', icon: '📜' },
    { id: 'profile', label: 'الملف الشخصي', icon: '👤' },
    { id: 'support', label: 'الدعم والشكاوى', icon: '💬' }
  ]

  const handleItemClick = (item) => {
    if (item.path) {
      router.push(item.path)
    } else if (item.id === 'profile') {
      router.push('/dashboard/courier-profile')
    } else if (item.id === 'support') {
      router.push('/support')
    } else {
      if (setActiveTab && router.pathname === '/dashboard/courier') {
        setActiveTab(item.id)
      } else {
        router.push(`/dashboard/courier?tab=${item.id}`)
      }
    }
    setIsOpen(false)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[110] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-[120] transform transition-transform duration-300
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                {user?.name?.charAt(0) || 'م'}
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-base leading-tight">{user?.name || 'مندوب'}</h2>
                <p className="text-xs text-orange-600 font-bold mt-0.5">مندوب توصيل 🛵</p>
              </div>
            </div>
          </div>

          {toggleOnlineStatus && (
            <div className="p-4 border-b border-slate-50">
              <button
                onClick={toggleOnlineStatus}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition-all font-bold border ${
                  isOnline 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                {isOnline ? 'أنت متصل الآن' : 'غير متصل (أوفلاين)'}
              </button>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {tabs.map(item => {
              const isActive = (item.id === 'profile' && router.pathname.includes('profile')) || 
                             (item.id === 'support' && router.pathname === '/support') ||
                             (activeTab === item.id && router.pathname === '/dashboard/courier')

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right
                    ${isActive 
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' 
                      : 'text-slate-600 hover:bg-slate-100'}
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="p-4 border-t border-slate-200 space-y-2">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all"
            >
              <span className="text-xl">🚪</span>
              <span className="font-medium">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

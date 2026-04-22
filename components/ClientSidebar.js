import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../services/auth'

export default function ClientSidebar({ isOpen, setIsOpen, activeFilter, setFilter }) {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const menuItems = [
    { id: 'all', label: 'الكل', icon: '📦', path: '/dashboard/client' },
    { id: 'active', label: 'تحت التنفيذ', icon: '🛵', path: '/dashboard/client' },
    { id: 'completed', label: 'المكتملة', icon: '✅', path: '/dashboard/client' },
    { id: 'profile', label: 'الملف الشخصي', icon: '👤', path: '/dashboard/client-profile' },
    { id: 'support', label: 'الدعم الفني', icon: '💬', path: '/support' }
  ]

  const handleItemClick = (item) => {
    if (item.path && item.path !== '/dashboard/client') {
      router.push(item.path)
    } else if (item.id === 'profile') {
      router.push('/dashboard/client-profile')
    } else if (item.id === 'support') {
      router.push('/support')
    } else {
      // It's a filter for the dashboard
      if (setFilter && router.pathname === '/dashboard/client') {
        setFilter(item.id)
      } else {
        router.push(`/dashboard/client?filter=${item.id}`)
      }
    }
    setIsOpen(false)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[110] lg:hidden backdrop-blur-sm transition-opacity"
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
              <div className="w-12 h-12 bg-gradient-to-br from-[#FF6A00] to-[#FF8A3D] rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                {user?.name?.charAt(0) || 'ع'}
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-base leading-tight">{user?.name || 'عميل'}</h2>
                <p className="text-xs text-[#FF6A00] font-bold mt-0.5">عميل 👤</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {menuItems.map(item => {
              const isActive = (item.id === 'profile' && router.pathname.includes('profile')) || 
                             (item.id === 'support' && router.pathname === '/support') ||
                             (activeFilter === item.id && router.pathname === '/dashboard/client')

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right
                    ${isActive 
                      ? 'bg-[#FF6A00] text-white shadow-lg shadow-[#FF6A00]/30' 
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

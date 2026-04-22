import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../services/auth'
import { useRouter } from 'next/router'

export default function NavBar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-[100] border-b border-slate-100 shadow-sm" dir="rtl">
        <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-20 sm:h-28">
            {/* Logo & Main Nav */}
            <div className="flex items-center gap-6 lg:gap-12">
              <Link href="/" className="flex items-center gap-3 sm:gap-6 group">
                <div className="w-12 h-12 sm:w-20 sm:h-20 relative">
                  <Image 
                    src="/logo.png" 
                    alt="Mandoobi logo" 
                    layout="fill" 
                    objectFit="contain" 
                    className="group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl sm:text-3xl font-black text-slate-900 tracking-tighter">Mandoobi <span className="text-[#FF6A00]">مندو بي</span></span>
                  <span className="hidden xs:block text-[8px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Fast & Reliable Delivery</span>
                </div>
              </Link>

              <div className="hidden md:flex items-center gap-2">
                  <NavLink href="/" label="الرئيسية" />
                  {user?.role === 'client' && <NavLink href="/dashboard/client" label="طلباتي" />}
                  {user?.role === 'courier' && <NavLink href="/dashboard/courier" label="لوحة المندوب" />}
                  {user?.role === 'client' && <NavLink href="/track" label="تتبع طلبك" />}
                  <NavLink href="/support" label="الدعم والشكاوى" />
                </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  {user.role === 'admin' && (
                    <Link href="/dashboard/admin" className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all shadow-lg shadow-slate-900/20">
                      <span>🛠️</span> لوحة التحكم
                    </Link>
                  )}
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">
                      {user.name?.[0] || 'U'}
                    </div>
                    <span className="text-sm font-black text-slate-700 hidden sm:inline">{user.name || 'مستخدم'}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="px-4 py-2 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all border border-rose-100 shadow-sm"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login" className="px-6 py-2.5 text-sm font-black text-slate-600 hover:text-[#FF6A00] transition-colors">تسجيل دخول</Link>
                  <Link href="/register" className="px-6 py-2.5 bg-[#FF6A00] text-white rounded-2xl text-sm font-black shadow-lg shadow-[#FF6A00]/20 hover:bg-[#FF8A3D] hover:scale-[1.02] transition-all">إنشاء حساب</Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-4">
              {user && (
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">
                  {user.name?.[0] || 'U'}
                </div>
              )}
              <button 
                onClick={toggleMenu}
                className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors relative z-[210]"
              >
                {isOpen ? (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Fullscreen Menu */}
      <div className={`md:hidden fixed inset-0 bg-white z-[200] transition-all duration-500 ease-in-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`} dir="rtl">
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-10 pt-4">
            <span className="text-2xl font-black text-slate-900 tracking-tighter">Mandoobi <span className="text-[#FF6A00]">مندو بي</span></span>
            <button onClick={toggleMenu} className="p-3 bg-slate-50 text-slate-900 rounded-2xl hover:bg-slate-100 transition-all">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <nav className="flex flex-col gap-4 flex-1 justify-center items-center">
             <MobileNavLink href="/" label="🏠 الرئيسية" onClick={toggleMenu} />
             {user?.role === 'client' && <MobileNavLink href="/dashboard/client" label="📦 طلباتي" onClick={toggleMenu} />}
             {user?.role === 'client' && <MobileNavLink href="/track" label="📍 تتبع طلبك" onClick={toggleMenu} />}
             <MobileNavLink href="/support" label="🎧 الدعم والشكاوى" onClick={toggleMenu} />
             {user?.role === 'admin' && <MobileNavLink href="/dashboard/admin" label="🛠️ لوحة التحكم" onClick={toggleMenu} />}
             {user?.role === 'courier' && <MobileNavLink href="/dashboard/courier" label="🛵 لوحة المندوب" onClick={toggleMenu} />}
           </nav>

          <div className="mt-auto py-10 border-t border-slate-100">
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-500/20">
                    {user.name?.[0]}
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-xl">{user.name}</div>
                    <div className="text-sm text-slate-400 font-bold uppercase">{user.role === 'admin' ? 'مدير النظام' : 'مندوب توصيل'}</div>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full py-5 bg-rose-50 text-rose-600 rounded-[2.5rem] font-black text-center text-lg shadow-sm"
                >تسجيل الخروج</button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Link href="/login" onClick={toggleMenu} className="w-full py-5 bg-slate-50 text-slate-900 rounded-[2.5rem] font-black text-center text-xl">تسجيل دخول</Link>
                <Link href="/register" onClick={toggleMenu} className="w-full py-5 bg-[#FF6A00] text-white rounded-[2.5rem] font-black text-center text-xl shadow-2xl shadow-[#FF6A00]/40">إنشاء حساب</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function NavLink({ href, label, highlight }) {
  return (
    <Link 
      href={href} 
      className={`px-5 py-2 rounded-xl text-sm font-black transition-all duration-300 transform hover:scale-105 active:scale-95 ${
        highlight 
          ? 'text-[#FF6A00] hover:bg-[#FF6A00]/10' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {label}
    </Link>
  )
}

function MobileNavLink({ href, label, onClick }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className="px-6 py-4 bg-slate-50 text-slate-600 rounded-2xl text-lg font-black hover:bg-[#FF6A00] hover:text-white transition-all active:scale-95"
    >
      {label}
    </Link>
  )
}


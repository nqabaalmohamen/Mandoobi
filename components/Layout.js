import NavBar from './NavBar'
import { useRouter } from 'next/router'
import { useAuth } from '../services/auth'

export default function Layout({children}){
  const { user } = useAuth() || {}
  const router = useRouter()
  
  const isDashboard = router.pathname.includes('/dashboard')
  const isOrderPage = router.pathname.includes('/order/')
  const isTrackPage = router.pathname.includes('/track')
  
  // Hide site NavBar if in dashboard, order, or track pages
  // Also hide if user is logged in on other pages (except home) to prevent double menus
  const hideNavBar = isDashboard || isOrderPage || isTrackPage || (user && router.pathname !== '/')

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-right">
      {!hideNavBar && <NavBar />}
      <main className={`max-w-[100%] mx-auto p-0 ${hideNavBar ? 'pt-0' : ''}`}>{children}</main>
    </div>
  )
}

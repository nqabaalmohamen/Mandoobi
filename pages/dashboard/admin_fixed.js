import { useEffect, useState } from 'react'
import { useAuth } from '../../services/auth'
import { subscribeToData, setData } from '../../services/db'
import { subscribeToOrders, updateOrderStatus } from '../../services/orders'
import { supabase } from '../../services/supabase'
import Link from 'next/link'


// --- Data Persistence Helpers (Updated for Cross-Device Sync) ---
const STORAGE_KEYS = {
  COURIERS: 'mandoobi_couriers',
  ORDERS: 'mandoobi_orders',
  USERS: 'mandoobi_users',
  SETTINGS: 'mandoobi_settings',
  SUPPORT: 'mandoobi_support_requests'
}

const syncToServer = async (key, value) => {
  try {
    // If it's a single item update, we should ideally use specific functions.
    // For now, we'll route settings to Supabase.
    if (key === STORAGE_KEYS.SETTINGS || key === 'mandoobi_settings') {
      await setData('settings', value)
    }
    
    // For other keys (users, orders, couriers), the admin dashboard currently 
    // sends the entire array. This is inefficient for Supabase but we'll 
    // handle the most critical ones or encourage individual updates.
    
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  } catch (e) {
    console.error(`Failed to sync ${key} to Supabase:`, e)
  }
}

export default function AdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [data, setData] = useState({
    users: [],
    orders: [],
    couriers: [],
    support: [],
    settings: { commission: 15, commissionType: 'percentage', baseFare: 20 }
  })

  // دالة لتحديث الإعدادات مباشرة عند أي تغيير
  const updateSettings = (newSettings) => {
    console.log('Updating settings:', newSettings);
    setData(prev => ({
      ...prev,
      settings: newSettings
    }));
    // حفظ الإعدادات تلقائياً
    syncToServer(STORAGE_KEYS.SETTINGS, newSettings)
  }
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [newUser, setNewUser] = useState({ name: '', phone: '', password: '', role: 'user', address: '', permissions: [] })
  const [notifications, setNotifications] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })

  // --- Modal States ---
  const [rejectionModal, setRejectionModal] = useState({ show: false, userId: null, status: '', reason: '' })
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null })
  const [previewImage, setPreviewImage] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [viewingCourier, setViewingCourier] = useState(null)
  const [adminPasswordData, setAdminPasswordData] = useState({ old: '', new: '', confirm: '' })

  // --- Initial & Live Load ---
  useEffect(() => {
    // Only subscribe if user is admin
    if (!user || user.role !== 'admin') return

    // 1. Subscribe to Users
    const unsubUsers = subscribeToData(STORAGE_KEYS.USERS, (users) => {
      setData(prev => ({ ...prev, users }))
    })

    // 2. Subscribe to Orders
    const unsubOrders = subscribeToOrders((orders) => {
      setData(prev => ({ ...prev, orders }))
    })

    // 3. Subscribe to Couriers
    const unsubCouriers = subscribeToData(STORAGE_KEYS.COURIERS, (couriers) => {
      setData(prev => ({ ...prev, couriers }))
      if (couriers.filter(c => c.status === 'pending').length > 0) {
        addNotify('تنبيه: يوجد طلبات انضمام مناديب جديدة بانتظار المراجعة', 'warning')
      }
    })

    // 4. Subscribe to Settings
    const unsubSettings = subscribeToData(STORAGE_KEYS.SETTINGS, (settings) => {
      if (settings && !Array.isArray(settings)) {
        setData(prev => ({ ...prev, settings }))
      }
    })

    // 5. Subscribe to Support Requests
    const unsubSupport = subscribeToData(STORAGE_KEYS.SUPPORT, (support) => {
      setData(prev => ({ ...prev, support }))
    })

    return () => {
      unsubUsers()
      unsubOrders()
      unsubCouriers()
      unsubSettings()
      unsubSupport()
    }
  }, [user])

  // Access Control: Only admins can view this page
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center p-10 bg-white rounded-3xl shadow-xl border border-slate-100">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">عذراً، لا تملك صلاحية الوصول</h2>
          <p className="text-slate-500 mb-8 font-bold">هذه الصفحة مخصصة لمسؤولي النظام فقط.</p>
          <a href="/login" className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition">العودة لتسجيل الدخول</a>
        </div>
      </div>
    )
  }

  // --- Permission Guard ---
  const hasPermission = (permissionId) => {
    // 1. If no user, no permission
    if (!user) return false;

    // 2. Main Admin (مدير الموقع) always has full access
    // Assuming original admin has id 'admin_123' or similar, or based on phone 'admin'
    if (user.phone === 'admin' || user.id === 'admin_123') return true;

    // 3. Find the user record in the latest data to get their current permissions
    const currentUserRecord = data.users.find(u => u.id === user.id || u.id === user.uid);

    // 4. Check if the user has the specific permission
    const userPermissions = currentUserRecord?.permissions || user.permissions || [];
    return userPermissions.includes(permissionId);
  }

  // إصلاح: ضمان أن useEffect يتم استدعاؤه مرة واحدة فقط
  useEffect(() => {
    setSearchTerm('')
    setSearchField('all')
  }, [activeTab])

  // --- Core Actions ---
  const addNotify = (msg, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [{ id, msg, type }, ...prev].slice(0, 5))
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }

  const handleUpdateCourier = (userId, status) => {
    if (status === 'rejected' || status === 'pending') {
      setRejectionModal({ show: true, userId, status, reason: '' })
      return
    }
    submitCourierUpdate(userId, status, '')
  }

  const submitCourierUpdate = async (userId, status, reason) => {
    try {
      await supabase.from('couriers').update({ status, statusReason: reason }).eq('userId', userId)
      await supabase.from('profiles').update({ courierStatus: status, courierStatusReason: reason }).eq('id', userId)
      
      addNotify(`تم تحديث حالة المندوب بنجاح`, status === 'approved' ? 'success' : 'error')
      setRejectionModal({ show: false, userId: null, status: '', reason: '' })
    } catch (e) {
      console.error("Courier update error:", e)
      addNotify("فشل تحديث حالة المندوب", "error")
    }
  }

  const handleDeleteUser = (id) => {
    setConfirmModal({
      show: true,
      title: '🚨 تأكيد الحذف النهائي',
      message: 'هل أنت متأكد من حذف كافة بيانات هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذه الخطوة.',
      onConfirm: async () => {
        // 1. Delete from users
        const updatedUsers = data.users.filter(u => u.id !== id)
        await syncToServer(STORAGE_KEYS.USERS, updatedUsers)

        // 2. Delete from couriers if exists
        const updatedCouriers = data.couriers.filter(c => c.userId !== id)
        await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)

        // 3. Delete related orders (Optional, but cleaner for demo)
        const updatedOrders = data.orders.filter(o => o.clientId !== id && o.courierId !== id)
        await syncToServer(STORAGE_KEYS.ORDERS, updatedOrders)

        addNotify('تم حذف المستخدم وكافة بياناته بنجاح', 'success')
        setConfirmModal({ show: false, title: '', message: '', onConfirm: null })
      }
    })
  }

  const handleSaveUser = async (updatedUser) => {
    // 1. Update user in users list
    const updatedUsers = data.users.map(u => u.id === updatedUser.id ? {
      ...u,
      name: updatedUser.name,
      phone: updatedUser.phone,
      role: updatedUser.role,
      permissions: updatedUser.permissions || u.permissions || []
    } : u)
    await syncToServer(STORAGE_KEYS.USERS, updatedUsers)

    // 2. If it's a courier, update courier specific data
    if (updatedUser.role === 'courier' || data.couriers.some(c => c.userId === updatedUser.id)) {
      const courierExists = data.couriers.some(c => c.userId === updatedUser.id)
      let updatedCouriers

      if (courierExists) {
        updatedCouriers = data.couriers.map(c => c.userId === updatedUser.id ? {
          ...c,
          nationalId: updatedUser.nationalId || c.nationalId,
          vehicleType: updatedUser.vehicleType || c.vehicleType,
          status: updatedUser.status || c.status
        } : c)
      } else {
        // If changed role to courier but no record exists yet
        updatedCouriers = [...data.couriers, {
          userId: updatedUser.id,
          nationalId: updatedUser.nationalId || '',
          vehicleType: updatedUser.vehicleType || 'motorcycle',
          status: 'approved' // Default to approved when admin manually sets it
        }]
      }
      await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)
    }

    addNotify('تم تحديث بيانات المستخدم بنجاح', 'success')
    setEditingUser(null)
  }

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.phone || !newUser.password) {
      addNotify('يرجى ملء كافة البيانات الأساسية', 'warning')
      return
    }

    const phoneExists = data.users.some(u => u.phone === newUser.phone)
    if (phoneExists) {
      addNotify('رقم الهاتف مسجل بالفعل لمستخدم آخر', 'error')
      return
    }

    const userId = `local_${Date.now()}`
    const userToSave = { ...newUser, id: userId }

    // 1. Add to users
    const updatedUsers = [...data.users, userToSave]
    await syncToServer(STORAGE_KEYS.USERS, updatedUsers)

    // 2. If courier, create courier record
    if (newUser.role === 'courier') {
      const updatedCouriers = [...data.couriers, {
        userId,
        status: 'approved', // Admin created couriers are approved by default
        vehicleType: 'motorcycle',
        nationalId: '---'
      }]
      await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)
    }

    addNotify(`تم إنشاء حساب ${newUser.role === 'admin' ? 'مسؤول' : newUser.role === 'courier' ? 'مندوب' : 'عميل'} جديد بنجاح`, 'success')
    const targetTab = newUser.role === 'admin' ? 'admins_list' : newUser.role === 'courier' ? 'couriers_list' : 'clients_list';
    setNewUser({ name: '', phone: '', password: '', role: 'user', address: '', permissions: [] })
    setActiveTab(targetTab) // Redirect to the specific list after adding
  }

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  const sortedData = (arr) => {
    if (!sortConfig.key) return arr;
    return [...arr].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  const handleUpdateOrder = async (id, status) => {
    try {
      await updateOrderStatus(id, status)
      addNotify(`تم تحديث حالة الطلب #${id} إلى ${status}`, 'info')
    } catch (e) {
      console.error("Order update error:", e)
      addNotify("فشل تحديث حالة الطلب", "error")
    }
  }

  const handleUpdateSettings = async (newSettings) => {
    await syncToServer(STORAGE_KEYS.SETTINGS, newSettings)
    addNotify('تم حفظ إعدادات النظام بنجاح', 'success')
  }

  // حفظ الإعدادات تلقائياً عند أي تغيير
  const saveSettingsOnChange = async (newSettings) => {
    await syncToServer(STORAGE_KEYS.SETTINGS, newSettings)
  }

  const refreshData = async () => {
    // Subscription handles updates, but we can force a refresh signal
    window.dispatchEvent(new Event('mandoobi_data_changed'))
    addNotify('جاري تحديث البيانات لحظياً...', 'info')
  }

  const exportToExcel = (type) => {
    // Implementation for exporting data to Excel
    addNotify('ميزة التصدير للإكسل قيد التطوير', 'info')
  }

  const exportToPDF = (type) => {
    // Implementation for exporting data to PDF
    addNotify('ميزة التصدير للPDF قيد التطوير', 'info')
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
                >
                  <span className="sr-only">فتح القائمة</span>
                  <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="ml-4 lg:ml-0">
                  <h1 className="text-2xl font-bold text-slate-900">لوحة تحكم المندوبين</h1>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="hidden lg:ml-4 lg:flex lg:items-center">
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="ml-4 flex-shrink-0 bg-white rounded-full p-1 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="sr-only">فتح ملف التعريف</span>
                  <img className="h-8 w-8 rounded-full" src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'مستخدم'}&background=3B82F6&color=fff`} alt="" />
                </button>
              </div>
              <button
                onClick={signOut}
                className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                تسجيل خروج
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row">
          {/* Sidebar */}
          <div className={`${isSidebarOpen ? 'block' : 'hidden'} lg:block lg:w-64 lg:pr-8 md:pr-4 mb-6 md:mb-0`}>
            <div className="bg-white rounded-lg shadow p-4">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'overview'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  نظرة عامة
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'settings'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  الإعدادات
                </button>
                <button
                  onClick={() => setActiveTab('couriers_list')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'couriers_list'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  المناديب
                </button>
                <button
                  onClick={() => setActiveTab('clients_list')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'clients_list'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  العملاء
                </button>
                <button
                  onClick={() => setActiveTab('admins_list')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'admins_list'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  المسؤولون
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'orders'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  الطلبات
                </button>
                <button
                  onClick={() => setActiveTab('support')}
                  className={`w-full flex items-center px-4 py-3 text-base font-medium rounded-md ${
                    activeTab === 'support'
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <svg className="ml-3 h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  الدعم الفني
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="mb-6 space-y-3">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg shadow ${
                      notification.type === 'success' ? 'bg-green-50 text-green-800' :
                      notification.type === 'error' ? 'bg-red-50 text-red-800' :
                      notification.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                      'bg-blue-50 text-blue-800'
                    }`}
                  >
                    <div className="flex">
                      <div className="flex-shrink-0">
                        {notification.type === 'success' ? (
                          <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : notification.type === 'error' ? (
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        ) : notification.type === 'warning' ? (
                          <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">{notification.msg}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">نظرة عامة</h2>
                  <button
                    onClick={refreshData}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    تحديث البيانات
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                        <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-blue-600">المناديب</p>
                        <p className="text-2xl font-bold text-slate-900">{data.couriers.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-6 border border-green-100">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                        <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-green-600">العملاء</p>
                        <p className="text-2xl font-bold text-slate-900">{data.users.filter(u => u.role === 'user').length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-100">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                        <svg className="h-6 w-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-yellow-600">الطلبات</p>
                        <p className="text-2xl font-bold text-slate-900">{data.orders.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-6 border border-purple-100">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                        <svg className="h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-purple-600">المسؤولون</p>
                        <p className="text-2xl font-bold text-slate-900">{data.users.filter(u => u.role === 'admin').length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pending Couriers */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-slate-900">المناديب الجدد قيد المراجعة</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {data.couriers.filter(c => c.status === 'pending').length} طلبات
                    </span>
                  </div>
                  {data.couriers.filter(c => c.status === 'pending').length > 0 ? (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <ul className="divide-y divide-slate-200">
                        {data.couriers.filter(c => c.status === 'pending').map((courier) => {
                          const user = data.users.find(u => u.id === courier.userId);
                          return (
                            <li key={courier.userId}>
                              <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <img className="h-10 w-10 rounded-full" src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'مندوب'}&background=3B82F6&color=fff`} alt="" />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-slate-900">{user?.name || 'غير معروف'}</div>
                                      <div className="text-sm text-slate-500">{user?.phone || 'غير معروف'}</div>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleUpdateCourier(courier.userId, 'approved')}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                    >
                                      قبول
                                    </button>
                                    <button
                                      onClick={() => handleUpdateCourier(courier.userId, 'rejected')}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                      رفض
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-slate-900">لا توجد مناديب جديد</h3>
                      <p className="mt-1 text-sm text-slate-500">لا يوجد مناديب بانتظار المراجعة حالياً</p>
                    </div>
                  )}
                </div>

                {/* Recent Orders */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-slate-900">الطلبات الأخيرة</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {data.orders.length} طلبات
                    </span>
                  </div>
                  {data.orders.length > 0 ? (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <ul className="divide-y divide-slate-200">
                        {sortedData(data.orders).slice(0, 5).map((order) => {
                          const client = data.users.find(u => u.id === order.clientId);
                          const courier = data.users.find(u => u.id === order.courierId);
                          return (
                            <li key={order.id}>
                              <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <img className="h-10 w-10 rounded-full" src={client?.photoURL || `https://ui-avatars.com/api/?name=${client?.name || 'عميل'}&background=3B82F6&color=fff`} alt="" />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-slate-900">طلب #{order.id}</div>
                                      <div className="text-sm text-slate-500">
                                        {client?.name || 'عميل'} → {courier?.name || 'مندوب'}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {order.status === 'pending' ? 'قيد الانتظار' :
                                       order.status === 'in_progress' ? 'قيد التنفيذ' :
                                       order.status === 'completed' ? 'مكتمل' : 'ملغي'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-slate-900">لا تطلبات</h3>
                      <p className="mt-1 text-sm text-slate-500">لا توجد طلبات مسجلة حالياً</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6">إعدادات النظام</h2>

                <div className="space-y-6">
                  {/* Commission Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">إعدادات العمولة</h3>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="commission" className="block text-sm font-medium text-slate-700">
                          نسبة العمولة
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="number"
                            id="commission"
                            min="0"
                            max="100"
                            value={data.settings.commission}
                            onChange={(e) => updateSettings({ ...data.settings, commission: parseInt(e.target.value) || 0 })}
                            className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-md sm:text-sm border-slate-300"
                          />
                          <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                            %
                          </span>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="commissionType" className="block text-sm font-medium text-slate-700">
                          نوع العمولة
                        </label>
                        <select
                          id="commissionType"
                          value={data.settings.commissionType}
                          onChange={(e) => updateSettings({ ...data.settings, commissionType: e.target.value })}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                          <option value="percentage">نسبة مئوية</option>
                          <option value="fixed">مبلغ ثابت</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Base Fare */}
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-4">الأساسيات</h3>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="baseFare" className="block text-sm font-medium text-slate-700">
                          الأجاس الأساسية للرحلة
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="number"
                            id="baseFare"
                            min="0"
                            value={data.settings.baseFare}
                            onChange={(e) => updateSettings({ ...data.settings, baseFare: parseInt(e.target.value) || 0 })}
                            className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-md sm:text-sm border-slate-300"
                          />
                          <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                            جنيه
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-6">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleUpdateSettings(data.settings)}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        حفظ الإعدادات
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Couriers List Tab */}
            {activeTab === 'couriers_list' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">قائمة المناديب</h2>
                  <button
                    onClick={() => {
                      setNewUser({ name: '', phone: '', password: '', role: 'courier', address: '', permissions: [] });
                      setActiveTab('create_courier');
                    }}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    إضافة مندوب جديد
                  </button>
                </div>

                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label htmlFor="search" className="sr-only">بحث</label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="search"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-10 py-2 sm:text-sm border-slate-300 rounded-md"
                        placeholder="بحث..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="roleFilter" className="block text-sm font-medium text-slate-700">التصنيف</label>
                    <select
                      id="roleFilter"
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="all">الكل</option>
                      <option value="approved">مقبول</option>
                      <option value="pending">قيد المراجعة</option>
                      <option value="rejected">مرفوض</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sortField" className="block text-sm font-medium text-slate-700">ترتيب حسب</label>
                    <select
                      id="sortField"
                      value={sortConfig.key}
                      onChange={(e) => handleSort(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="name">الاسم</option>
                      <option value="phone">رقم الهاتف</option>
                      <option value="status">الحالة</option>
                      <option value="createdAt">تاريخ الإنشاء</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sortDirection" className="block text-sm font-medium text-slate-700">الترتيب</label>
                    <select
                      id="sortDirection"
                      value={sortConfig.direction}
                      onChange={(e) => setSortConfig({ ...sortConfig, direction: e.target.value })}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="asc">تصاعدي</option>
                      <option value="desc">تنازلي</option>
                    </select>
                  </div>
                </div>

                {/* Couriers List */}
                {data.couriers.length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-slate-200">
                      {sortedData(
                        data.couriers
                          .filter(c => {
                            const user = data.users.find(u => u.id === c.userId);
                            const matchesSearch = searchTerm === '' || 
                              (user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              user?.phone?.includes(searchTerm));
                            const matchesRole = userRoleFilter === 'all' || c.status === userRoleFilter;
                            return matchesSearch && matchesRole;
                          })
                          .map((courier) => {
                            const user = data.users.find(u => u.id === courier.userId);
                            return (
                              <li key={courier.userId}>
                                <div className="px-4 py-4 sm:px-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 h-10 w-10">
                                        <img className="h-10 w-10 rounded-full" src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'مندوب'}&background=3B82F6&color=fff`} alt="" />
                                      </div>
                                      <div className="ml-4">
                                        <div className="text-sm font-medium text-slate-900">{user?.name || 'غير معروف'}</div>
                                        <div className="text-sm text-slate-500">{user?.phone || 'غير معروف'}</div>
                                        <div className="mt-1 flex items-center">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            courier.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            courier.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                          }`}>
                                            {courier.status === 'approved' ? 'مقبول' :
                                             courier.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                                          </span>
                                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {courier.vehicleType === 'motorcycle' ? 'دراجة نارية' : 
                                             courier.vehicleType === 'car' ? 'سيارة' : 'غير محدد'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => {
                                          setViewingCourier(courier);
                                          setShowProfileModal(true);
                                        }}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                      >
                                        عرض التفاصيل
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(courier.userId)}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                      >
                                        حذف
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">لا يوجد مناديب</h3>
                    <p className="mt-1 text-sm text-slate-500">لم يتم تسجيل أي مناديب بعد</p>
                  </div>
                )}
              </div>
            )}

            {/* Clients List Tab */}
            {activeTab === 'clients_list' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">قائمة العملاء</h2>
                  <button
                    onClick={() => {
                      setNewUser({ name: '', phone: '', password: '', role: 'user', address: '', permissions: [] });
                      setActiveTab('create_user');
                    }}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    إضافة عميل جديد
                  </button>
                </div>

                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="search" className="sr-only">بحث</label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="search"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-10 py-2 sm:text-sm border-slate-300 rounded-md"
                        placeholder="بحث..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sortField" className="block text-sm font-medium text-slate-700">ترتيب حسب</label>
                    <select
                      id="sortField"
                      value={sortConfig.key}
                      onChange={(e) => handleSort(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="name">الاسم</option>
                      <option value="phone">رقم الهاتف</option>
                      <option value="createdAt">تاريخ الإنشاء</option>
                    </select>
                  </div>
                </div>

                {/* Clients List */}
                {data.users.filter(u => u.role === 'user').length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-slate-200">
                      {sortedData(
                        data.users
                          .filter(u => u.role === 'user')
                          .filter(user => {
                            const matchesSearch = searchTerm === '' || 
                              (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              user.phone?.includes(searchTerm));
                            return matchesSearch;
                          })
                          .map((user) => (
                            <li key={user.id}>
                              <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <img className="h-10 w-10 rounded-full" src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}&background=3B82F6&color=fff`} alt="" />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                      <div className="text-sm text-slate-500">{user.phone}</div>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => {
                                        setEditingUser(user);
                                        setShowProfileModal(true);
                                      }}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      تعديل
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                      حذف
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">لا يوجد عملاء</h3>
                    <p className="mt-1 text-sm text-slate-500">لم يتم تسجيل أي عملاء بعد</p>
                  </div>
                )}
              </div>
            )}

            {/* Admins List Tab */}
            {activeTab === 'admins_list' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">قائمة المسؤولين</h2>
                  <button
                    onClick={() => {
                      setNewUser({ name: '', phone: '', password: '', role: 'admin', address: '', permissions: [] });
                      setActiveTab('create_user');
                    }}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    إضافة مسؤول جديد
                  </button>
                </div>

                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="search" className="sr-only">بحث</label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="search"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-10 py-2 sm:text-sm border-slate-300 rounded-md"
                        placeholder="بحث..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sortField" className="block text-sm font-medium text-slate-700">ترتيب حسب</label>
                    <select
                      id="sortField"
                      value={sortConfig.key}
                      onChange={(e) => handleSort(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="name">الاسم</option>
                      <option value="phone">رقم الهاتف</option>
                      <option value="createdAt">تاريخ الإنشاء</option>
                    </select>
                  </div>
                </div>

                {/* Admins List */}
                {data.users.filter(u => u.role === 'admin').length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-slate-200">
                      {sortedData(
                        data.users
                          .filter(u => u.role === 'admin')
                          .filter(user => {
                            const matchesSearch = searchTerm === '' || 
                              (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              user.phone?.includes(searchTerm));
                            return matchesSearch;
                          })
                          .map((user) => (
                            <li key={user.id}>
                              <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <img className="h-10 w-10 rounded-full" src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}&background=3B82F6&color=fff`} alt="" />
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                      <div className="text-sm text-slate-500">{user.phone}</div>
                                      {user.phone === 'admin' && (
                                        <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                          المدير الرئيسي
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => {
                                        setEditingUser(user);
                                        setShowProfileModal(true);
                                      }}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      تعديل
                                    </button>
                                    {user.phone !== 'admin' && (
                                      <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                      >
                                        حذف
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">لا يوجد مسؤولون</h3>
                    <p className="mt-1 text-sm text-slate-500">لم يتم تسجيل أي مسؤولين بعد</p>
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">قائمة الطلبات</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => exportToExcel('orders')}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      تصدير للإكسل
                    </button>
                    <button
                      onClick={() => exportToPDF('orders')}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      تصدير للPDF
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="search" className="sr-only">بحث</label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="search"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-10 py-2 sm:text-sm border-slate-300 rounded-md"
                        placeholder="بحث..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="statusFilter" className="block text-sm font-medium text-slate-700">الحالة</label>
                    <select
                      id="statusFilter"
                      value={searchField}
                      onChange={(e) => setSearchField(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="all">الكل</option>
                      <option value="pending">قيد الانتظار</option>
                      <option value="in_progress">قيد التنفيذ</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sortField" className="block text-sm font-medium text-slate-700">ترتيب حسب</label>
                    <select
                      id="sortField"
                      value={sortConfig.key}
                      onChange={(e) => handleSort(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="id">رقم الطلب</option>
                      <option value="createdAt">تاريخ الإنشاء</option>
                      <option value="status">الحالة</option>
                    </select>
                  </div>
                </div>

                {/* Orders List */}
                {data.orders.length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-slate-200">
                      {sortedData(
                        data.orders
                          .filter(order => {
                            const matchesSearch = searchTerm === '' || 
                              (order.id.toString().includes(searchTerm) ||
                              order.details?.toLowerCase().includes(searchTerm.toLowerCase()));
                            const matchesStatus = searchField === 'all' || order.status === searchField;
                            return matchesSearch && matchesStatus;
                          })
                          .map((order) => {
                            const client = data.users.find(u => u.id === order.clientId);
                            const courier = data.users.find(u => u.id === order.courierId);
                            return (
                              <li key={order.id}>
                                <div className="px-4 py-4 sm:px-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 h-10 w-10">
                                        <img className="h-10 w-10 rounded-full" src={client?.photoURL || `https://ui-avatars.com/api/?name=${client?.name || 'عميل'}&background=3B82F6&color=fff`} alt="" />
                                      </div>
                                      <div className="ml-4">
                                        <div className="text-sm font-medium text-slate-900">طلب #{order.id}</div>
                                        <div className="text-sm text-slate-500">
                                          {client?.name || 'عميل'} → {courier?.name || 'مندوب'}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">
                                          {order.details || 'لا توجد تفاصيل'}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                        {order.status === 'pending' ? 'قيد الانتظار' :
                                         order.status === 'in_progress' ? 'قيد التنفيذ' :
                                         order.status === 'completed' ? 'مكتمل' : 'ملغي'}
                                      </span>
                                      <div className="ml-4 flex space-x-2">
                                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                                          <button
                                            onClick={() => handleUpdateOrder(order.id, 'completed')}
                                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                          >
                                            إكمال
                                          </button>
                                        )}
                                        {order.status !== 'cancelled' && (
                                          <button
                                            onClick={() => handleUpdateOrder(order.id, 'cancelled')}
                                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                          >
                                            إلغاء
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">لا تطلبات</h3>
                    <p className="mt-1 text-sm text-slate-500">لا توجد طلبات مسجلة حالياً</p>
                  </div>
                )}
              </div>
            )}

            {/* Support Tab */}
            {activeTab === 'support' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">طلبات الدعم الفني</h2>
                  <button
                    onClick={() => {
                      // Implementation for creating a new support request
                      addNotify('ميزة إنشاء طلب دعم قيد التطوير', 'info');
                    }}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    طلب دعم جديد
                  </button>
                </div>

                {/* Support Requests List */}
                {data.support.length > 0 ? (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-slate-200">
                      {sortedData(data.support).map((request) => {
                        const user = data.users.find(u => u.id === request.userId);
                        return (
                          <li key={request.id}>
                            <div className="px-4 py-4 sm:px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img className="h-10 w-10 rounded-full" src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'مستخدم'}&background=3B82F6&color=fff`} alt="" />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-slate-900">{user?.name || 'غير معروف'}</div>
                                    <div className="text-sm text-slate-500">{request.subject}</div>
                                    <div className="mt-1 text-sm text-slate-500">
                                      {request.message.substring(0, 50)}...
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    request.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                                    request.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {request.status === 'open' ? 'مفتوح' :
                                     request.status === 'in_progress' ? 'قيد المعالجة' : 'مغلق'}
                                  </span>
                                  <div className="ml-4 flex space-x-2">
                                    <button
                                      onClick={() => {
                                        // Implementation for viewing support request details
                                        addNotify('ميزة عرض تفاصيل طلب الدعم قيد التطوير', 'info');
                                      }}
                                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                      عرض التفاصيل
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">لا تطلبات دعم</h3>
                    <p className="mt-1 text-sm text-slate-500">لا توجد طلبات دعم فني مسجلة حالياً</p>
                  </div>
                )}
              </div>
            )}

            {/* Create User Tab */}
            {(activeTab === 'create_user' || activeTab === 'create_courier') && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    {activeTab === 'create_user' ? 'إضافة عميل جديد' : 'إضافة مندوب جديد'}
                  </h2>
                  <button
                    onClick={() => setActiveTab(activeTab === 'create_user' ? 'clients_list' : 'couriers_list')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    العودة للقائمة
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateUser();
                }} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                        الاسم الكامل
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                        رقم الهاتف
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        required
                        value={newUser.phone}
                        onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                        كلمة المرور
                      </label>
                      <input
                        type="password"
                        id="password"
                        required
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                      />
                    </div>

                    {activeTab === 'create_courier' && (
                      <>
                        <div>
                          <label htmlFor="vehicleType" className="block text-sm font-medium text-slate-700">
                            نوع المركبة
                          </label>
                          <select
                            id="vehicleType"
                            value={newUser.vehicleType || 'motorcycle'}
                            onChange={(e) => setNewUser({ ...newUser, vehicleType: e.target.value })}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                          >
                            <option value="motorcycle">دراجة نارية</option>
                            <option value="car">سيارة</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="nationalId" className="block text-sm font-medium text-slate-700">
                            الرقم القومي
                          </label>
                          <input
                            type="text"
                            id="nationalId"
                            value={newUser.nationalId || ''}
                            onChange={(e) => setNewUser({ ...newUser, nationalId: e.target.value })}
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-slate-700">
                        العنوان
                      </label>
                      <input
                        type="text"
                        id="address"
                        value={newUser.address || ''}
                        onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="pt-6">
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        إنشاء الحساب
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                      {editingUser ? 'تعديل بيانات المستخدم' : 'تفاصيل الحساب'}
                    </h3>
                    <div className="mt-2">
                      {editingUser ? (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveUser(editingUser);
                        }} className="space-y-4">
                          <div>
                            <label htmlFor="editName" className="block text-sm font-medium text-slate-700">
                              الاسم الكامل
                            </label>
                            <input
                              type="text"
                              id="editName"
                              value={editingUser.name}
                              onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                            />
                          </div>

                          <div>
                            <label htmlFor="editPhone" className="block text-sm font-medium text-slate-700">
                              رقم الهاتف
                            </label>
                            <input
                              type="tel"
                              id="editPhone"
                              value={editingUser.phone}
                              onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                              className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                            />
                          </div>

                          {editingUser.role === 'courier' && (
                            <>
                              <div>
                                <label htmlFor="editVehicleType" className="block text-sm font-medium text-slate-700">
                                  نوع المركبة
                                </label>
                                <select
                                  id="editVehicleType"
                                  value={editingUser.vehicleType || 'motorcycle'}
                                  onChange={(e) => setEditingUser({ ...editingUser, vehicleType: e.target.value })}
                                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                >
                                  <option value="motorcycle">دراجة نارية</option>
                                  <option value="car">سيارة</option>
                                </select>
                              </div>

                              <div>
                                <label htmlFor="editNationalId" className="block text-sm font-medium text-slate-700">
                                  الرقم القومي
                                </label>
                                <input
                                  type="text"
                                  id="editNationalId"
                                  value={editingUser.nationalId || ''}
                                  onChange={(e) => setEditingUser({ ...editingUser, nationalId: e.target.value })}
                                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                                />
                              </div>
                            </>
                          )}

                          <div className="flex justify-end space-x-3 pt-4">
                            <button
                              type="button"
                              onClick={() => setShowProfileModal(false)}
                              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                            >
                              إلغاء
                            </button>
                            <button
                              type="submit"
                              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              حفظ التغييرات
                            </button>
                          </div>
                        </form>
                      ) : viewingCourier ? (
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12">
                              <img className="h-12 w-12 rounded-full" src={viewingCourier.photoURL || `https://ui-avatars.com/api/?name=${viewingCourier.name}&background=3B82F6&color=fff`} alt="" />
                            </div>
                            <div className="ml-4">
                              <h4 className="text-lg font-medium text-slate-900">{viewingCourier.name}</h4>
                              <p className="text-sm text-slate-500">{viewingCourier.phone}</p>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-4">
                            <h5 className="text-md font-medium text-slate-900 mb-2">معلومات المندوب</h5>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                              <div>
                                <dt className="text-sm font-medium text-slate-500">نوع المركبة</dt>
                                <dd className="mt-1 text-sm text-slate-900">
                                  {viewingCourier.vehicleType === 'motorcycle' ? 'دراجة نارية' : 
                                   viewingCourier.vehicleType === 'car' ? 'سيارة' : 'غير محدد'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-sm font-medium text-slate-500">الحالة</dt>
                                <dd className="mt-1">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    viewingCourier.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    viewingCourier.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {viewingCourier.status === 'approved' ? 'مقبول' :
                                     viewingCourier.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                                  </span>
                                </dd>
                              </div>
                              <div>
                                <dt className="text-sm font-medium text-slate-500">الرقم القومي</dt>
                                <dd className="mt-1 text-sm text-slate-900">
                                  {viewingCourier.nationalId || 'غير مسجل'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-sm font-medium text-slate-500">تاريخ التسجيل</dt>
                                <dd className="mt-1 text-sm text-slate-900">
                                  {new Date(viewingCourier.createdAt || Date.now()).toLocaleDateString('ar-SA')}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          <div className="flex justify-end pt-4">
                            <button
                              onClick={() => setShowProfileModal(false)}
                              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              إغلاق
                            </button>
                          </div>
                        </div>
                      ) : user ? (
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12">
                              <img className="h-12 w-12 rounded-full" src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}&background=3B82F6&color=fff`} alt="" />
                            </div>
                            <div className="ml-4">
                              <h4 className="text-lg font-medium text-slate-900">{user.name}</h4>
                              <p className="text-sm text-slate-500">{user.phone}</p>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-4">
                            <h5 className="text-md font-medium text-slate-900 mb-2">معلومات الحساب</h5>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                              <div>
                                <dt className="text-sm font-medium text-slate-500">الدور</dt>
                                <dd className="mt-1 text-sm text-slate-900">
                                  {user.role === 'admin' ? 'مسؤول' : 
                                   user.role === 'courier' ? 'مندوب' : 'عميل'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-sm font-medium text-slate-500">تاريخ التسجيل</dt>
                                <dd className="mt-1 text-sm text-slate-900">
                                  {new Date(user.createdAt || Date.now()).toLocaleDateString('ar-SA')}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          <div className="flex justify-end pt-4">
                            <button
                              onClick={() => setShowProfileModal(false)}
                              className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              إغلاق
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal.show && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                        {rejectionModal.status === 'rejected' ? 'رفض طلب مندوب' : 'مراجعة طلب مندوب'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-slate-500">
                        {rejectionModal.status === 'rejected' ? 
                         'يرجى إدخال سبب الرفض ليتم إعلام المندوب بالسبب.' :
                         'يرجى إدخال ملاحظاتك حول هذا الطلب.'}
                      </p>
                      <div className="mt-4">
                        <label htmlFor="rejectionReason" className="block text-sm font-medium text-slate-700">
                          {rejectionModal.status === 'rejected' ? 'سبب الرفض' : 'ملاحظات'}
                        </label>
                        <textarea
                          id="rejectionReason"
                          rows={3}
                          value={rejectionModal.reason}
                          onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-slate-300 rounded-md"
                        ></textarea>
                      </div>
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setRejectionModal({ show: false, userId: null, status: '', reason: '' })}
                          className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            submitCourierUpdate(rejectionModal.userId, rejectionModal.status, rejectionModal.reason);
                          }}
                          className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {rejectionModal.status === 'rejected' ? 'رفض الطلب' : 'إرسال الملاحظات'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                      {confirmModal.title}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-slate-500">
                        {confirmModal.message}
                      </p>
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null })}
                          className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmModal.onConfirm) confirmModal.onConfirm();
                            setConfirmModal({ show: false, title: '', message: '', onConfirm: null });
                          }}
                          className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          تأكيد
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

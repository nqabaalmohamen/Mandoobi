import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useAuth, subscribeToData } from '../../services/auth'
import { subscribeToOrders } from '../../services/orders'
import { setData } from '../../services/db'
import Link from 'next/link'
import Head from 'next/head'

const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'

const STORAGE_KEYS = {
  COURIERS: 'mandoobi_couriers',
  ORDERS: 'mandoobi_orders',
  USERS: 'profiles',
  SETTINGS: 'mandoobi_settings',
  SUPPORT: 'mandoobi_support_requests',
  PASSWORD_REQUESTS: 'mandoobi_password_requests'
}

const AVAILABLE_PERMISSIONS = [
  { id: 'orders', label: 'إدارة الطلبات' },
  { id: 'users', label: 'إدارة المستخدمين' },
  { id: 'couriers', label: 'إدارة المناديب' },
  { id: 'support', label: 'الدعم الفني' },
  { id: 'settings', label: 'الإعدادات' },
  { id: 'passwords', label: 'طلبات كلمات المرور' }
]

const syncToServer = async (key, value) => {
  try {
    await setData(key, value)
  } catch (e) {
    console.error(`Failed to sync ${key} to Firestore:`, e)
  }
}

const statusLabels = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  open: 'مفتوح',
  in_progress: 'قيد المعالجة',
  closed: 'مغلق',
  completed: 'مكتمل',
  cancelled: 'ملغي'
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  // Sync tab with URL on mount and whenever it changes
  useEffect(() => {
    if (router.isReady) {
      if (router.query.tab) {
        setActiveTab(router.query.tab)
      } else {
        // Set default tab in URL if none exists
        router.replace({ query: { ...router.query, tab: 'overview' } }, undefined, { shallow: true })
      }
    }
  }, [router.isReady])

  useEffect(() => {
    if (router.isReady && activeTab && router.query.tab !== activeTab) {
      router.replace({ query: { ...router.query, tab: activeTab } }, undefined, { shallow: true })
    }
  }, [activeTab, router.isReady])

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [data, setAdminData] = useState({
    users: [],
    orders: [],
    couriers: [],
    support: [],
    passwordRequests: [],
    settings: { 
      commission: 15, 
      commissionType: 'percentage', 
      baseFare: 35,
      maintenanceMode: false,
      maintenanceEndTime: null
    }
  })
  const [notifications, setNotifications] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' })
  const [editingItem, setEditingItem] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', phone: '', password: '', role: 'client', address: '' })
  const prevOrdersRef = useRef([])

  const addNotify = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [{ id, msg, type }, ...prev].slice(0, 5))
    
    // Play sound for all notifications except info ones that aren't important
    if (type !== 'info' || msg.includes('طلب جديد')) {
      const audio = new Audio(NOTIFICATION_SOUND)
      audio.play().catch(e => console.log('Audio play blocked:', e))
    }

    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
  }, [])

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

  const handleModalFileUpload = async (e, field) => {
    const file = e.target.files[0]
    if (file) {
      try {
        const compressed = await compressImage(file)
        setModalData(prev => ({
          ...prev,
          courierData: {
            ...prev.courierData,
            [field]: compressed
          }
        }))
        addNotify('تم تجهيز الصورة بنجاح، يرجى حفظ التعديلات', 'info')
      } catch (err) {
        console.error("Compression failed", err)
        addNotify('فشل ضغط الصورة، يرجى المحاولة مرة أخرى', 'error')
      }
    }
  }

  useEffect(() => {
    if (!user || user.role !== 'admin') return

    const unsubUsers = subscribeToData(STORAGE_KEYS.USERS, (users) => {
      setAdminData(prev => ({ ...prev, users }))
    })

    const unsubOrders = subscribeToOrders((orders) => {
      // Check for new orders
      if (prevOrdersRef.current.length > 0) {
        const newOrders = orders.filter(o => 
          !prevOrdersRef.current.some(prev => prev.id === o.id) && 
          o.status === 'pending'
        )
        
        if (newOrders.length > 0) {
          addNotify(`يوجد ${newOrders.length} طلب جديد بانتظار المراجعة 📦`, 'success')
        }
      }
      prevOrdersRef.current = orders
      setAdminData(prev => ({ ...prev, orders }))
    })

    const unsubCouriers = subscribeToData(STORAGE_KEYS.COURIERS, (couriers) => {
      setAdminData(prev => ({ ...prev, couriers }))
      const pendingCount = couriers.filter(c => c.status === 'pending').length
      if (pendingCount > 0) {
        addNotify(`يوجد ${pendingCount} مندوب بانتظار المراجعة`, 'warning')
      }
    })

    const unsubSettings = subscribeToData(STORAGE_KEYS.SETTINGS, (settings) => {
      if (settings && !Array.isArray(settings)) {
        setAdminData(prev => {
          // Only update if current tab is NOT settings to avoid overwriting user input
          if (activeTab === 'settings') return prev;
          return { ...prev, settings };
        })
      }
    })

    const unsubSupport = subscribeToData(STORAGE_KEYS.SUPPORT, (support) => {
      setAdminData(prev => ({ ...prev, support }))
    })

    const unsubPasswordRequests = subscribeToData(STORAGE_KEYS.PASSWORD_REQUESTS, (passwordRequests) => {
      setAdminData(prev => ({ ...prev, passwordRequests }))
    })

    return () => {
      unsubUsers()
      unsubOrders()
      unsubCouriers()
      unsubSettings()
      unsubSupport()
      unsubPasswordRequests()
    }
  }, [user, addNotify])

  useEffect(() => {
    if (user === null) {
      router.push('/')
    }
  }, [user, router])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-bold">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (user === null || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800" dir="rtl">
        <div className="text-center p-10 bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20">
          <div className="text-7xl mb-6">🔒</div>
          <h2 className="text-3xl font-black text-white mb-4">عذراً، لا تملك صلاحية الوصول</h2>
          <p className="text-slate-300 mb-8 text-lg">هذه الصفحة مخصصة لمسؤولي النظام فقط.</p>
          <button onClick={() => router.push('/')} className="px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg">العودة للرئيسية</button>
        </div>
      </div>
    )
  }

  const isMainAdmin = user?.phone === 'admin' || user?.id === 'admin_123'

  const getUserById = (id) => data.users.find(u => u.id === id)
  const getCourierByUserId = (userId) => data.couriers.find(c => c.userId === userId)

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedData = (arr) => {
    if (!sortConfig.key) return arr
    return [...arr].sort((a, b) => {
      let aVal = a[sortConfig.key] || ''
      let bVal = b[sortConfig.key] || ''
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const filteredUsers = sortedData(
    data.users.filter(u => {
      const matchesSearch = !searchTerm || 
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone?.includes(searchTerm)
      const roleMap = { 'clients': 'client', 'couriers': 'courier', 'admins': 'admin' }
      const matchesRole = activeTab === 'all_users' ? true : u.role === roleMap[activeTab]
      return matchesSearch && matchesRole
    })
  )

  const filteredOrders = sortedData(
    data.orders.filter(o => {
      const client = getUserById(o.clientId)
      const courier = getUserById(o.courierId)
      const matchesSearch = !searchTerm ||
        o.id?.includes(searchTerm) ||
        client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter
      return matchesSearch && matchesStatus
    })
  )

  const filteredCouriers = sortedData(
    data.couriers.filter(c => {
      const courierUser = getUserById(c.userId)
      const matchesSearch = !searchTerm ||
        courierUser?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courierUser?.phone?.includes(searchTerm)
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  )

  const filteredSupport = sortedData(
    data.support.filter(s => {
      const matchesSearch = !searchTerm ||
        s.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.message?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  )

  const handleDelete = async (type, id) => {
    if (!confirm('هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء.')) return

    if (type === 'user') {
      const updatedUsers = data.users.filter(u => u.id !== id)
      const updatedCouriers = data.couriers.filter(c => c.userId !== id)
      const updatedOrders = data.orders.filter(o => o.clientId !== id && o.courierId !== id)
      await syncToServer(STORAGE_KEYS.USERS, updatedUsers)
      await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)
      await syncToServer(STORAGE_KEYS.ORDERS, updatedOrders)
      addNotify('تم حذف المستخدم بنجاح', 'success')
    } else if (type === 'order') {
      const updatedOrders = data.orders.filter(o => o.id !== id)
      await syncToServer(STORAGE_KEYS.ORDERS, updatedOrders)
      addNotify('تم حذف الطلب بنجاح', 'success')
    } else if (type === 'support') {
      const updatedSupport = data.support.filter(s => s.id !== id)
      await syncToServer(STORAGE_KEYS.SUPPORT, updatedSupport)
      addNotify('تم حذف طلب الدعم بنجاح', 'success')
    }
    setShowModal(null)
  }

  const handleUpdateStatus = async (type, id, newStatus) => {
    if (type === 'courier') {
      const updatedCouriers = data.couriers.map(c => 
        c.userId === id ? { ...c, status: newStatus } : c
      )
      await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)
      addNotify(`تم تحديث حالة المندوب إلى ${statusLabels[newStatus]}`, 'success')
    } else if (type === 'order') {
      const updatedOrders = data.orders.map(o => 
        o.id === id ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o
      )
      await syncToServer(STORAGE_KEYS.ORDERS, updatedOrders)
      addNotify(`تم تحديث حالة الطلب إلى ${statusLabels[newStatus]}`, 'success')
    } else if (type === 'support') {
      const updatedSupport = data.support.map(s => 
        s.id === id ? { ...s, status: newStatus } : s
      )
      await syncToServer(STORAGE_KEYS.SUPPORT, updatedSupport)
      addNotify(`تم تحديث حالة الطلب إلى ${statusLabels[newStatus]}`, 'success')
    }
    setShowModal(null)
  }

  const handleCreateUser = async () => {
    if (!newItem.name || !newItem.phone || !newItem.password) {
      addNotify('يرجى ملء جميع الحقول المطلوبة', 'warning')
      return
    }

    const phoneExists = data.users.some(u => u.phone === newItem.phone)
    if (phoneExists) {
      addNotify('رقم الهاتف مسجل بالفعل', 'error')
      return
    }

    const userId = `local_${Date.now()}`
    const userToSave = { ...newItem, id: userId, createdAt: new Date().toISOString() }
    const updatedUsers = [...data.users, userToSave]
    await syncToServer(STORAGE_KEYS.USERS, updatedUsers)

    if (newItem.role === 'courier') {
      const updatedCouriers = [...data.couriers, {
        userId,
        status: 'approved',
        vehicleType: 'motorcycle',
        nationalId: '',
        createdAt: new Date().toISOString()
      }]
      await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)
    }

    addNotify(`تم إنشاء ${newItem.role === 'admin' ? 'مسؤول' : newItem.role === 'courier' ? 'مندوب' : 'عميل'} جديد بنجاح`, 'success')
    setNewItem({ name: '', phone: '', password: '', role: 'client', address: '' })
    setShowModal(null)
  }

  const handleSaveSettings = async () => {
    await syncToServer(STORAGE_KEYS.SETTINGS, data.settings)
    addNotify('تم حفظ الإعدادات بنجاح', 'success')
  }

  const getOrderStats = () => {
    const total = data.orders.length
    const completed = data.orders.filter(o => o.status === 'completed').length
    const pending = data.orders.filter(o => o.status === 'pending').length
    const cancelled = data.orders.filter(o => o.status === 'cancelled').length
    return { total, completed, pending, cancelled }
  }

  const orderStats = getOrderStats()
  const totalRevenue = data.orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (parseFloat(o.price || o.totalCost) || 0), 0)

  const stats = {
    totalUsers: data.users.length,
    clients: data.users.filter(u => u.role === 'client' || u.role === 'user').length,
    couriers: data.users.filter(u => u.role === 'courier').length,
    admins: data.users.filter(u => u.role === 'admin').length,
    orders: orderStats.total,
    pendingOrders: orderStats.pending,
    completedOrders: orderStats.completed,
    totalRevenue,
    pendingCouriers: data.couriers.filter(c => c.status === 'pending').length,
    openSupport: data.support.filter(s => s.status === 'open').length
  }

  const menuItems = [
    { id: 'overview', label: 'نظرة عامة', icon: '📊' },
    { id: 'all_users', label: 'جميع المستخدمين', icon: '👥', permission: 'users' },
    { id: 'clients', label: 'العملاء', icon: '👤', permission: 'users' },
    { id: 'couriers', label: 'المناديب', icon: '🏍️', permission: 'couriers' },
    { id: 'admins', label: 'المسؤولون', icon: '🛡️', permission: 'users' },
    { id: 'orders', label: 'الطلبات', icon: '📦', permission: 'orders' },
    { id: 'support', label: 'الدعم الفني', icon: '💬', badge: stats.openSupport, permission: 'support' },
    { id: 'password_requests', label: 'طلبات كلمة السر', icon: '🔑', badge: data.passwordRequests.filter(r => r.status === 'pending').length, permission: 'passwords' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️', permission: 'settings' },
    { id: 'go_home', label: 'الذهاب للموقع', icon: '🌐' }
  ]

  const visibleMenuItems = menuItems.filter(item => {
    if (isMainAdmin || !item.permission) return true
    return user.permissions?.includes(item.permission)
  })

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-white shadow-md px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-slate-100 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-800">لوحة التحكم</h1>
        <img 
          src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'م'}&background=3B82F6&color=fff`} 
          alt="" 
          className="w-8 h-8 rounded-full" 
        />
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm transition-opacity" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-[120] transform transition-transform duration-300
        lg:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                م
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">مندوبي</h2>
                <p className="text-sm text-slate-500">لوحة التحكم</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {visibleMenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'go_home') {
                    router.push('/')
                    return
                  }
                  setActiveTab(item.id)
                  setMobileMenuOpen(false)
                  setSearchTerm('')
                  setStatusFilter('all')
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right
                  ${activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                    : 'text-slate-600 hover:bg-slate-100'}
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.badge > 0 && (
                  <span className="mr-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-200">
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

      {/* Main Content */}
      <div className="lg:mr-72 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white shadow-sm border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {menuItems.find(m => m.id === activeTab)?.label || 'لوحة التحكم'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">مرحباً {user.name}، إليك ملخص اليوم</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 px-4 py-2 pr-10 bg-slate-100 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Link href="/dashboard/admin-profile">
              <img 
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.name || 'م'}&background=3B82F6&color=fff`} 
                alt="" 
                className="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
              />
            </Link>
          </div>
        </header>

        {/* Mobile Header Spacer */}
        <div className="lg:hidden h-16" />

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 lg:left-auto lg:right-8 lg:w-96 z-50 space-y-2">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-up ${
                  notification.type === 'success' ? 'bg-green-500 text-white' :
                  notification.type === 'error' ? 'bg-red-500 text-white' :
                  notification.type === 'warning' ? 'bg-yellow-500 text-white' :
                  'bg-blue-500 text-white'
                }`}
              >
                <span className="text-xl">
                  {notification.type === 'success' ? '✓' :
                   notification.type === 'error' ? '✕' :
                   notification.type === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <span className="flex-1 font-medium">{notification.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 lg:p-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl">👥</div>
                    <div>
                      <p className="text-slate-500 text-sm">المستخدمين</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.totalUsers}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-2xl">👤</div>
                    <div>
                      <p className="text-slate-500 text-sm">العملاء</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.clients}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl">🏍️</div>
                    <div>
                      <p className="text-slate-500 text-sm">المناديب</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.couriers}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl">📦</div>
                    <div>
                      <p className="text-slate-500 text-sm">الطلبات</p>
                      <p className="text-2xl font-bold text-slate-800">{stats.orders}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-2xl">💰</div>
                    <div>
                      <p className="text-slate-500 text-sm">إجمالي الأرباح</p>
                      <p className="text-2xl font-bold text-emerald-600">{stats.totalRevenue} ج.م</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">المناديب بانتظار المراجعة</h3>
                    <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                      {stats.pendingCouriers} طلبات
                    </span>
                  </div>
                  {data.couriers.filter(c => c.status === 'pending').length > 0 ? (
                    <div className="space-y-3">
                      {data.couriers.filter(c => c.status === 'pending').slice(0, 5).map(c => {
                        const courierUser = getUserById(c.userId)
                        // دمج البيانات لضمان الوصول للمرفقات حتى لو كانت مخزنة في كائن المستخدم
                        const courier = { ...courierUser, ...c }
                        return (
                          <div key={courier.userId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <img 
                                src={courierUser?.photoURL || `https://ui-avatars.com/api/?name=${courierUser?.name || 'م'}&background=FFA500&color=fff`} 
                                alt="" 
                                className="w-10 h-10 rounded-full"
                              />
                              <div>
                                <p className="font-medium text-slate-800">{courierUser?.name || 'غير معروف'}</p>
                                <p className="text-sm text-slate-500">{courierUser?.phone}</p>
                                {/* المرفقات للمراجعة السريعة */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {courier.profileImage && (
                                    <button onClick={() => { setModalData({ title: 'الصورة الشخصية', img: courier.profileImage }); setShowModal('view_image') }} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold">👤</button>
                                  )}
                                  <button 
                                    onClick={() => { if(courier.idFront) { setModalData({ title: 'صورة البطاقة (أمام)', img: courier.idFront }); setShowModal('view_image') } }} 
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${courier.idFront ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-rose-50 text-rose-400 opacity-60'}`}
                                  >
                                    💳 أمام {!courier.idFront && '(ناقص)'}
                                  </button>
                                  <button 
                                    onClick={() => { if(courier.idBack) { setModalData({ title: 'صورة البطاقة (خلف)', img: courier.idBack }); setShowModal('view_image') } }} 
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${courier.idBack ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-rose-50 text-rose-400 opacity-60'}`}
                                  >
                                    💳 خلف {!courier.idBack && '(ناقص)'}
                                  </button>
                                  {courier.licenseImage && (
                                    <button onClick={() => { setModalData({ title: 'الرخصة', img: courier.licenseImage }); setShowModal('view_image') }} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">📜</button>
                                  )}
                                  {courier.vehicleImage && (
                                    <button onClick={() => { setModalData({ title: 'المركبة', img: courier.vehicleImage }); setShowModal('view_image') }} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">🏍️</button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateStatus('courier', courier.userId, 'approved')}
                                className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
                              >
                                قبول
                              </button>
                              <button
                                onClick={() => handleUpdateStatus('courier', courier.userId, 'rejected')}
                                className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
                              >
                                رفض
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <div className="text-4xl mb-2">✓</div>
                      <p>لا يوجد مناديب بانتظار المراجعة</p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800">آخر الطلبات</h3>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="text-blue-600 text-sm font-medium hover:underline"
                    >
                      عرض الكل
                    </button>
                  </div>
                  {data.orders.length > 0 ? (
                    <div className="space-y-3">
                      {data.orders.slice(0, 5).map(order => {
                        const client = getUserById(order.clientId)
                        return (
                          <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div>
                              <p className="font-medium text-slate-800">طلب #{order.id}</p>
                              <p className="text-sm text-slate-500">{client?.name || 'عميل'}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === 'completed' ? 'bg-green-100 text-green-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {statusLabels[order.status] || order.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <div className="text-4xl mb-2">📦</div>
                      <p>لا توجد طلبات بعد</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">إحصائيات سريعة</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-3xl font-bold text-blue-600">{orderStats.pending}</p>
                    <p className="text-slate-500 text-sm mt-1">طلبات قيد الانتظار</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-3xl font-bold text-green-600">{orderStats.completed}</p>
                    <p className="text-slate-500 text-sm mt-1">طلبات مكتملة</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-3xl font-bold text-purple-600">{stats.admins}</p>
                    <p className="text-slate-500 text-sm mt-1">المسؤولون</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <p className="text-3xl font-bold text-orange-600">{stats.pendingCouriers}</p>
                    <p className="text-slate-500 text-sm mt-1">مناديب بانتظار القبول</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Users / Clients / Couriers / Admins Tabs */}
          {['all_users', 'clients', 'couriers', 'admins'].includes(activeTab) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-white rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="approved">مقبول</option>
                    <option value="pending">قيد المراجعة</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                  <button
                    onClick={() => setShowModal('create')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/30"
                  >
                    + إضافة جديد
                  </button>
                </div>
                <p className="text-slate-500 text-sm">
                  {filteredUsers.length} مستخدم
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">المستخدم</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">رقم الهاتف</th>
                        {isMainAdmin && <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">كلمة المرور</th>}
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">النوع</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">الحالة</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">تاريخ التسجيل</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.length > 0 ? filteredUsers.map(u => {
                        const courierData = getCourierByUserId(u.id)
                        return (
                          <tr key={u.id} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={u.photoURL || `https://ui-avatars.com/api/?name=${u.name || 'م'}&background=3B82F6&color=fff`} 
                                  alt="" 
                                  className="w-10 h-10 rounded-full"
                                />
                                <span className="font-medium text-slate-800">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{u.phone}</td>
                            {isMainAdmin && <td className="px-6 py-4 text-slate-600 font-mono">{u.password}</td>}
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                u.role === 'courier' ? 'bg-orange-100 text-orange-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {u.role === 'admin' ? 'مسؤول' : u.role === 'courier' ? 'مندوب' : 'عميل'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                courierData?.status === 'approved' || u.role !== 'courier' ? 'bg-green-100 text-green-700' :
                                courierData?.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {u.role === 'courier' ? (statusLabels[courierData?.status] || 'غير معروف') : 'نشط'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-sm">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingItem(u)
                                    setModalData({ ...u, courierData })
                                    setShowModal('edit')
                                  }}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => handleDelete('user', u.id)}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                                >
                                  حذف
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                            <div className="text-4xl mb-2">👥</div>
                            <p>لا يوجد مستخدمين</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Couriers Tab */}
          {activeTab === 'couriers' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-white rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="approved">مقبول</option>
                    <option value="pending">قيد المراجعة</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                  <button
                    onClick={() => {
                      setNewItem(prev => ({ ...prev, role: 'courier' }))
                      setShowModal('create')
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/30"
                  >
                    + إضافة مندوب
                  </button>
                </div>
                <p className="text-slate-500 text-sm">
                  {filteredCouriers.length} مندوب
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCouriers.length > 0 ? filteredCouriers.map(c => {
                  const courierUser = getUserById(c.userId)
                  const courier = { ...courierUser, ...c }
                  return (
                    <div key={courier.userId} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={courierUser?.photoURL || `https://ui-avatars.com/api/?name=${courierUser?.name || 'م'}&background=FFA500&color=fff`} 
                            alt="" 
                            className="w-12 h-12 rounded-full"
                          />
                          <div>
                            <p className="font-bold text-slate-800">{courierUser?.name || 'غير معروف'}</p>
                            <p className="text-sm text-slate-500">{courierUser?.phone}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          courier.status === 'approved' ? 'bg-green-100 text-green-700' :
                          courier.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {statusLabels[courier.status]}
                        </span>
                      </div>
                      
                      <div className="text-sm text-slate-500 mb-4 space-y-1 flex-grow">
                        <p className="flex justify-between"><span>نوع المركبة:</span> <span className="font-bold text-slate-700">{courier.vehicleType === 'motorcycle' ? 'دراجة نارية' : courier.vehicleType === 'car' ? 'سيارة' : 'غير محدد'}</span></p>
                        <p className="flex justify-between"><span>الرقم القومي:</span> <span className="font-bold text-slate-700">{courier.nationalId || '-'}</span></p>
                      </div>

                      {/* المرفقات للمندوب */}
                      {(courier.idFront || courier.idBack || courier.licenseImage || courier.vehicleImage || courier.profileImage) && (
                        <div className="mb-4 pt-4 border-t border-slate-50">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">المرفقات والوثائق</p>
                          <div className="flex flex-wrap gap-2">
                            {courier.profileImage && (
                              <button onClick={() => { setModalData({ title: 'الصورة الشخصية', img: courier.profileImage }); setShowModal('view_image') }} className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold transition">👤 الصورة الشخصية</button>
                            )}
                            <button 
                              onClick={() => { if(courier.idFront) { setModalData({ title: 'صورة البطاقة (أمام)', img: courier.idFront }); setShowModal('view_image') } }} 
                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${courier.idFront ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-rose-50 text-rose-400 opacity-60'}`}
                            >
                              💳 البطاقة (أمام) {!courier.idFront && '(غير موجودة)'}
                            </button>
                            <button 
                              onClick={() => { if(courier.idBack) { setModalData({ title: 'صورة البطاقة (خلف)', img: courier.idBack }); setShowModal('view_image') } }} 
                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${courier.idBack ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-rose-50 text-rose-400 opacity-60'}`}
                            >
                              💳 البطاقة (خلف) {!courier.idBack && '(غير موجودة)'}
                            </button>
                            {courier.licenseImage && (
                              <button onClick={() => { setModalData({ title: 'رخصة القيادة', img: courier.licenseImage }); setShowModal('view_image') }} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold transition">📜 الرخصة</button>
                            )}
                            {courier.vehicleImage && (
                              <button onClick={() => { setModalData({ title: 'صورة المركبة', img: courier.vehicleImage }); setShowModal('view_image') }} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold transition">🏍️ المركبة</button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {courier.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus('courier', courier.userId, 'approved')}
                              className="flex-1 px-3 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition"
                            >
                              قبول
                            </button>
                            <button
                              onClick={() => handleUpdateStatus('courier', courier.userId, 'rejected')}
                              className="flex-1 px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition"
                            >
                              رفض
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete('user', courier.userId)}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="col-span-full text-center py-12 text-slate-400">
                    <div className="text-5xl mb-3">🏍️</div>
                    <p className="text-lg font-medium">لا يوجد مناديب</p>
                    <p className="text-sm">سيظهر المناديب هنا عند تسجيلهم</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-white rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="pending">قيد الانتظار</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
                <p className="text-slate-500 text-sm">
                  {filteredOrders.length} طلب
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">رقم الطلب</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">العميل</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">المندوب</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">الحالة</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">التكلفة</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.length > 0 ? filteredOrders.map(order => {
                        const client = getUserById(order.clientId)
                        const courier = getUserById(order.courierId)
                        return (
                          <tr key={order.id} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4 font-medium text-slate-800">#{order.id}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <img 
                                  src={client?.photoURL || `https://ui-avatars.com/api/?name=${client?.name || 'ع'}&background=22C55E&color=fff`} 
                                  alt="" 
                                  className="w-8 h-8 rounded-full"
                                />
                                <span className="text-slate-600">{client?.name || 'غير معروف'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <img 
                                  src={courier?.photoURL || `https://ui-avatars.com/api/?name=${courier?.name || 'م'}&background=FFA500&color=fff`} 
                                  alt="" 
                                  className="w-8 h-8 rounded-full"
                                />
                                <span className="text-slate-600">{courier?.name || 'لم يحدد'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {statusLabels[order.status] || order.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{order.cost || order.totalCost || order.price || 0} جنيه</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2 items-center">
                                {order.transferImage && (
                                  <button onClick={() => { setModalData({ title: `إيصال دفع الطلب #${order.id}`, img: order.transferImage }); setShowModal('view_image') }} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition" title="مشاهدة إيصال الدفع">🖼️</button>
                                )}
                                <select
                                  value={order.status}
                                  onChange={(e) => handleUpdateStatus('order', order.id, e.target.value)}
                                  className="px-2 py-1 bg-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="pending">قيد الانتظار</option>
                                  <option value="in_progress">قيد التنفيذ</option>
                                  <option value="completed">مكتمل</option>
                                  <option value="cancelled">ملغي</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                            <div className="text-4xl mb-2">📦</div>
                            <p>لا توجد طلبات</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Support Tab */}
          {activeTab === 'support' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">كل الحالات</option>
                  <option value="open">مفتوح</option>
                  <option value="in_progress">قيد المعالجة</option>
                  <option value="closed">مغلق</option>
                </select>
                <p className="text-slate-500 text-sm">
                  {filteredSupport.length} طلب دعم
                </p>
              </div>

              <div className="space-y-4">
                {filteredSupport.length > 0 ? filteredSupport.map(request => {
                  const requestUser = getUserById(request.userId)
                  return (
                    <div key={request.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={requestUser?.photoURL || `https://ui-avatars.com/api/?name=${requestUser?.name || 'م'}&background=8B5CF6&color=fff`} 
                            alt="" 
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-bold text-slate-800">{requestUser?.name || 'غير معروف'}</p>
                            <p className="text-sm text-slate-500">{requestUser?.phone}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          request.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                          request.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {statusLabels[request.status]}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 mb-2">{request.subject}</h4>
                      <p className="text-slate-600 mb-4">{request.message}</p>
                      <div className="flex gap-2">
                        <select
                          value={request.status}
                          onChange={(e) => handleUpdateStatus('support', request.id, e.target.value)}
                          className="px-3 py-2 bg-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="open">مفتوح</option>
                          <option value="in_progress">قيد المعالجة</option>
                          <option value="closed">مغلق</option>
                        </select>
                        <button
                          onClick={() => handleDelete('support', request.id)}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="text-center py-12 text-slate-400 bg-white rounded-2xl">
                    <div className="text-5xl mb-3">💬</div>
                    <p className="text-lg font-medium">لا توجد طلبات دعم</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Password Requests Tab */}
          {activeTab === 'password_requests' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">طلبات استعادة كلمة السر</h3>
                <p className="text-slate-500 text-sm">
                  {data.passwordRequests.length} طلب
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">المستخدم</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">رقم الهاتف</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">التاريخ</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">الحالة</th>
                        <th className="px-6 py-4 text-right text-sm font-bold text-slate-600">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.passwordRequests.length > 0 ? data.passwordRequests.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => {
                        const targetUser = data.users.find(u => u.phone === req.phone)
                        return (
                          <tr key={req.id} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4 font-medium text-slate-800">{targetUser?.name || 'غير مسجل'}</td>
                            <td className="px-6 py-4 text-slate-600">{req.phone}</td>
                            <td className="px-6 py-4 text-slate-500 text-sm">{new Date(req.createdAt).toLocaleString('ar-EG')}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {req.status === 'pending' ? 'قيد الانتظار' : 'تم التواصل'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                {req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      const updated = data.passwordRequests.map(r => r.id === req.id ? { ...r, status: 'completed' } : r)
                                      await syncToServer(STORAGE_KEYS.PASSWORD_REQUESTS, updated)
                                      addNotify('تم تحديث حالة الطلب', 'success')
                                    }}
                                    className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition"
                                  >
                                    تم التواصل
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if(!confirm('حذف هذا الطلب؟')) return
                                    const updated = data.passwordRequests.filter(r => r.id !== req.id)
                                    await syncToServer(STORAGE_KEYS.PASSWORD_REQUESTS, updated)
                                    addNotify('تم حذف الطلب', 'success')
                                  }}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                                >
                                  حذف
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            <div className="text-4xl mb-2">🔑</div>
                            <p>لا توجد طلبات حالياً</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                <h3 className="text-lg font-bold text-slate-800">إعدادات النظام</h3>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">نسبة العمولة</label>
                    <div className="flex">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={data.settings.commission}
                        onChange={(e) => setData(prev => ({ 
                          ...prev, 
                          settings: { ...prev.settings, commission: parseInt(e.target.value) || 0 }
                        }))}
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="inline-flex items-center px-4 bg-slate-200 rounded-r-xl text-slate-600">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">نوع العمولة</label>
                    <select
                      value={data.settings.commissionType}
                      onChange={(e) => setData(prev => ({ 
                        ...prev, 
                        settings: { ...prev.settings, commissionType: e.target.value }
                      }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="percentage">نسبة مئوية</option>
                      <option value="fixed">مبلغ ثابت</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">الأجر الأساسي للرحلة</label>
                    <div className="flex">
                      <input
                        type="number"
                        min="0"
                        value={data.settings.baseFare}
                        onChange={(e) => setData(prev => ({ 
                          ...prev, 
                          settings: { ...prev.settings, baseFare: parseInt(e.target.value) || 0 }
                        }))}
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="inline-flex items-center px-4 bg-slate-200 rounded-r-xl text-slate-600">جنيه</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span>🚧</span> وضع الصيانة (قفل النظام)
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">تفعيل وضع الصيانة</p>
                        <p className="text-sm text-slate-500">عند التفعيل، لن يتمكن أي مستخدم (غير الأدمن) من دخول الموقع.</p>
                      </div>
                      <button
                        onClick={() => setData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, maintenanceMode: !prev.settings.maintenanceMode }
                        }))}
                        className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${data.settings.maintenanceMode ? 'bg-red-500' : 'bg-slate-300'}`}
                      >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${data.settings.maintenanceMode ? 'translate-x-0' : 'translate-x-6'}`} />
                      </button>
                    </div>

                    {data.settings.maintenanceMode && (
                      <div className="animate-slide-up">
                        <label className="block text-sm font-medium text-slate-700 mb-2">وقت انتهاء الصيانة (العد التنازلي)</label>
                        <input
                          type="datetime-local"
                          value={data.settings.maintenanceEndTime || ''}
                          onChange={(e) => setData(prev => ({
                            ...prev,
                            settings: { ...prev.settings, maintenanceEndTime: e.target.value }
                          }))}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <p className="mt-2 text-xs text-rose-500 font-medium">سيظهر هذا التوقيت كعد تنازلي للمستخدمين.</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/30"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">
                  {showModal === 'create' ? 'إضافة مستخدم جديد' : 'تعديل بيانات المستخدم'}
                </h3>
                <button
                  onClick={() => { setShowModal(null); setEditingItem(null); setModalData(null) }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {showModal === 'create' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">الاسم</label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      placeholder="اسم المستخدم"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={newItem.phone}
                      onChange={(e) => setNewItem(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">كلمة المرور</label>
                    <input
                      type="text"
                      value={newItem.password}
                      onChange={(e) => setNewItem(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-3">نوع الحساب</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'client', label: 'عميل', icon: '👤' },
                        { id: 'courier', label: 'مندوب', icon: '🏍️' },
                        { id: 'admin', label: 'مسؤول', icon: '🛡️' }
                      ].map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setNewItem(prev => ({ ...prev, role: r.id }))}
                          className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                            newItem.role === r.id 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' 
                              : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <span className="text-xl">{r.icon}</span>
                          <span className="text-xs font-bold">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {newItem.role === 'admin' && (
                    <div className="col-span-full">
                      <label className="block text-sm font-medium text-slate-700 mb-3">صلاحيات الوصول</label>
                      <div className="grid grid-cols-2 gap-3">
                        {AVAILABLE_PERMISSIONS.map(p => (
                          <label key={p.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                            <input
                              type="checkbox"
                              checked={newItem.permissions?.includes(p.id)}
                              onChange={(e) => {
                                const perms = newItem.permissions || []
                                if (e.target.checked) {
                                  setNewItem(prev => ({ ...prev, permissions: [...perms, p.id] }))
                                } else {
                                  setNewItem(prev => ({ ...prev, permissions: perms.filter(id => id !== p.id) }))
                                }
                              }}
                              className="w-5 h-5 rounded text-blue-600"
                            />
                            <span className="text-sm font-medium text-slate-700">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">العنوان</label>
                    <input
                      type="text"
                      value={newItem.address}
                      onChange={(e) => setNewItem(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      placeholder="العنوان"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">الاسم</label>
                    <input
                      type="text"
                      value={modalData?.name || ''}
                      onChange={(e) => setModalData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={modalData?.phone || ''}
                      onChange={(e) => setModalData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium text-slate-700 mb-3">نوع الحساب</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'client', label: 'عميل', icon: '👤' },
                        { id: 'courier', label: 'مندوب', icon: '🏍️' },
                        { id: 'admin', label: 'مسؤول', icon: '🛡️' }
                      ].map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setModalData(prev => ({ ...prev, role: r.id }))}
                          className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                            modalData?.role === r.id 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' 
                              : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <span className="text-xl">{r.icon}</span>
                          <span className="text-xs font-bold">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ملفات الرفع المخفية للمسؤول */}
                  <input type="file" id="upload-profile" className="hidden" onChange={(e) => handleModalFileUpload(e, 'profileImage')} />
                  <input type="file" id="upload-idFront" className="hidden" onChange={(e) => handleModalFileUpload(e, 'idFront')} />
                  <input type="file" id="upload-idBack" className="hidden" onChange={(e) => handleModalFileUpload(e, 'idBack')} />
                  <input type="file" id="upload-license" className="hidden" onChange={(e) => handleModalFileUpload(e, 'licenseImage')} />
                  <input type="file" id="upload-vehicle" className="hidden" onChange={(e) => handleModalFileUpload(e, 'vehicleImage')} />

                  {modalData?.role === 'admin' && (
                    <div className="col-span-full">
                      <label className="block text-sm font-medium text-slate-700 mb-3">صلاحيات الوصول</label>
                      <div className="grid grid-cols-2 gap-3">
                        {AVAILABLE_PERMISSIONS.map(p => (
                          <label key={p.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                            <input
                              type="checkbox"
                              checked={modalData.permissions?.includes(p.id)}
                              onChange={(e) => {
                                const perms = modalData.permissions || []
                                if (e.target.checked) {
                                  setModalData(prev => ({ ...prev, permissions: [...perms, p.id] }))
                                } else {
                                  setModalData(prev => ({ ...prev, permissions: perms.filter(id => id !== p.id) }))
                                }
                              }}
                              className="w-5 h-5 rounded text-blue-600"
                            />
                            <span className="text-sm font-medium text-slate-700">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {isMainAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">كلمة المرور</label>
                      <input
                        type="text"
                        value={modalData?.password || ''}
                        onChange={(e) => setModalData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  {modalData?.role === 'courier' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">نوع المركبة</label>
                      <select
                        value={modalData?.courierData?.vehicleType || 'motorcycle'}
                        onChange={(e) => setModalData(prev => ({ 
                          ...prev, 
                          courierData: { ...prev.courierData, vehicleType: e.target.value }
                        }))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-100 border-0 focus:ring-2 focus:ring-blue-500 mb-4"
                      >
                        <option value="motorcycle">دراجة نارية</option>
                        <option value="car">سيارة</option>
                      </select>

                      {/* المرفقات في مودال التعديل */}
                      {(modalData?.courierData?.idFront || modalData?.idFront || modalData?.courierData?.idBack || modalData?.idBack || modalData?.courierData?.licenseImage || modalData?.licenseImage || modalData?.courierData?.vehicleImage || modalData?.vehicleImage || modalData?.courierData?.profileImage || modalData?.profileImage) && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-3">المرفقات الحالية</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              type="button"
                              onClick={() => { 
                                const img = modalData.courierData?.profileImage || modalData.profileImage;
                                if(img) { setModalData(prev => ({ ...prev, viewImg: { title: 'الصورة الشخصية', img } })); setShowModal('view_image_nested') }
                                else { document.getElementById('upload-profile').click() }
                              }} 
                              className={`flex items-center justify-center gap-2 p-3 border rounded-xl text-xs font-bold transition ${ (modalData.courierData?.profileImage || modalData.profileImage) ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                            >
                              👤 {(modalData.courierData?.profileImage || modalData.profileImage) ? 'الصورة الشخصية' : 'رفع صورة شخصية'}
                            </button>
                            <button 
                              type="button"
                              onClick={() => { 
                                const img = modalData.courierData?.idFront || modalData.idFront;
                                if(img) { setModalData(prev => ({ ...prev, viewImg: { title: 'صورة البطاقة (أمام)', img } })); setShowModal('view_image_nested') }
                                else { document.getElementById('upload-idFront').click() }
                              }} 
                              className={`flex items-center justify-center gap-2 p-3 border rounded-xl text-xs font-bold transition ${ (modalData.courierData?.idFront || modalData.idFront) ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                            >
                              💳 {(modalData.courierData?.idFront || modalData.idFront) ? 'البطاقة (أمام)' : 'رفع البطاقة (أمام)'}
                            </button>
                            <button 
                              type="button"
                              onClick={() => { 
                                const img = modalData.courierData?.idBack || modalData.idBack;
                                if(img) { setModalData(prev => ({ ...prev, viewImg: { title: 'صورة البطاقة (خلف)', img } })); setShowModal('view_image_nested') }
                                else { document.getElementById('upload-idBack').click() }
                              }} 
                              className={`flex items-center justify-center gap-2 p-3 border rounded-xl text-xs font-bold transition ${ (modalData.courierData?.idBack || modalData.idBack) ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                            >
                              💳 {(modalData.courierData?.idBack || modalData.idBack) ? 'البطاقة (خلف)' : 'رفع البطاقة (خلف)'}
                            </button>
                            <button 
                              type="button"
                              onClick={() => { 
                                const img = modalData.courierData?.licenseImage || modalData.licenseImage;
                                if(img) { setModalData(prev => ({ ...prev, viewImg: { title: 'الرخصة', img } })); setShowModal('view_image_nested') }
                                else { document.getElementById('upload-license').click() }
                              }} 
                              className={`flex items-center justify-center gap-2 p-3 border rounded-xl text-xs font-bold transition ${ (modalData.courierData?.licenseImage || modalData.licenseImage) ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                            >
                              📜 {(modalData.courierData?.licenseImage || modalData.licenseImage) ? 'الرخصة' : 'رفع الرخصة'}
                            </button>
                            <button 
                              type="button"
                              onClick={() => { 
                                const img = modalData.courierData?.vehicleImage || modalData.vehicleImage;
                                if(img) { setModalData(prev => ({ ...prev, viewImg: { title: 'المركبة', img } })); setShowModal('view_image_nested') }
                                else { document.getElementById('upload-vehicle').click() }
                              }} 
                              className={`flex items-center justify-center gap-2 p-3 border rounded-xl text-xs font-bold transition ${ (modalData.courierData?.vehicleImage || modalData.vehicleImage) ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                            >
                              🏍️ {(modalData.courierData?.vehicleImage || modalData.vehicleImage) ? 'المركبة' : 'رفع صورة المركبة'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => { setShowModal(null); setEditingItem(null); setModalData(null) }}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={showModal === 'create' ? handleCreateUser : async () => {
                  try {
                    if (!modalData) return
                    // تحديث بيانات المستخدم
                    const updatedUsers = data.users.map(u => 
                      u.id === modalData.id ? { 
                        ...u, 
                        name: modalData.name, 
                        phone: modalData.phone, 
                        role: modalData.role,
                        password: modalData.password,
                        permissions: modalData.permissions || []
                      } : u
                    )
                    await syncToServer(STORAGE_KEYS.USERS, updatedUsers)

                    // تحديث بيانات المندوب إذا كان النوع مندوب
                    if (modalData.role === 'courier' && modalData.courierData) {
                      const courierExists = data.couriers.some(c => c.userId === modalData.id)
                      let updatedCouriers
                      if (courierExists) {
                        updatedCouriers = data.couriers.map(c => 
                          c.userId === modalData.id ? { ...c, ...modalData.courierData } : c
                        )
                      } else {
                        updatedCouriers = [...data.couriers, { ...modalData.courierData, userId: modalData.id, status: 'approved' }]
                      }
                      await syncToServer(STORAGE_KEYS.COURIERS, updatedCouriers)
                    }

                    addNotify('تم تحديث البيانات بنجاح', 'success')
                    setShowModal(null)
                    setEditingItem(null)
                    setModalData(null)
                  } catch (err) {
                    console.error('Save failed:', err)
                    addNotify('فشل حفظ التعديلات، قد تكون الصور كبيرة جداً', 'error')
                  }
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/30"
              >
                {showModal === 'create' ? 'إضافة' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {(showModal === 'view_image' || showModal === 'view_image_nested') && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="relative max-w-4xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">{showModal === 'view_image_nested' ? modalData?.viewImg?.title : modalData?.title || 'عرض المرفق'}</h3>
              <button onClick={() => setShowModal(showModal === 'view_image_nested' ? 'edit' : null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all">✕</button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-y-auto flex justify-center bg-slate-50">
              <img src={showModal === 'view_image_nested' ? modalData?.viewImg?.img : modalData?.img} alt="" className="max-w-full h-auto rounded-2xl shadow-sm border border-slate-200" />
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowModal(showModal === 'view_image_nested' ? 'edit' : null)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all">إغلاق</button>
            </div>
          </div>
        </div>
      )}


      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 lg:left-auto lg:right-8 lg:w-96 z-[200] space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-up border ${
              n.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
              n.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' : 
              n.type === 'warning' ? 'bg-amber-500 border-amber-400 text-white' :
              'bg-blue-600 border-blue-500 text-white'
            }`}>
              <span className="text-xl">{n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : n.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
              <p className="font-bold text-sm leading-relaxed">{n.msg}</p>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .pb-safe-area {
          padding-bottom: env(safe-area-inset-bottom);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
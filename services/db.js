// ===================================
// Database Service - localStorage Only
// ===================================

const DEFAULTS = {
  mandoobi_settings: {
    commission: 15,
    commissionType: 'percentage',
    baseFare: 35,
    maintenanceMode: false,
    maintenanceEndTime: null
  },
  mandoobi_users: [],
  mandoobi_orders: [],
  mandoobi_couriers: [],
  mandoobi_support_requests: []
}

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mandoobi_data_changed'))
  }
}

export function getData(key) {
  if (typeof window === 'undefined') return DEFAULTS[key] ?? []
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
    return DEFAULTS[key] ?? []
  } catch {
    return DEFAULTS[key] ?? []
  }
}

export function setData(key, value) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
    emit()
  } catch (e) {
    console.error('setData error:', e)
  }
}

export function subscribeToKey(key, callback) {
  // immediate call
  callback(getData(key))
  const handler = () => callback(getData(key))
  if (typeof window !== 'undefined') {
    window.addEventListener('mandoobi_data_changed', handler)
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mandoobi_data_changed', handler)
    }
  }
}

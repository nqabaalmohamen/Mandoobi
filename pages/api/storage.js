import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'local_db.json')

// Helper to initialize DB
const initDB = () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      mandoobi_orders: [],
      mandoobi_users: [{ id: 'admin_123', name: 'مدير الموقع', phone: 'admin', password: 'admin', role: 'admin' }],
      mandoobi_support_requests: [],
      mandoobi_settings: { 
        commission: 15, 
        commissionType: 'percentage', 
        baseFare: 20,
        maintenanceMode: false,
        maintenanceEndTime: null
      }
    }, null, 2))
  }
}

export default function handler(req, res) {
  initDB()
  const { method } = req
  const { key } = req.query

  if (method === 'GET') {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    if (key) {
      return res.status(200).json(data[key] || [])
    }
    return res.status(200).json(data)
  }

  if (method === 'POST') {
    const { key, value } = req.body
    if (!key) return res.status(400).json({ error: 'Key is required' })

    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    data[key] = value
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
    
    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${method} Not Allowed`)
}

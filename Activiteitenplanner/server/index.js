const express = require('express')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const DB_PATH = path.join(__dirname, '..', 'db.json')

function readDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (err) {
    return {}
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
}

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' })
  }

  const db = readDb()
  const users = Array.isArray(db.users) ? db.users : []
  const user = users.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase())
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const stored = user.password || ''
  let ok = false
  try {
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      ok = await bcrypt.compare(password, stored)
    } else {
      ok = password === stored
    }
  } catch (err) {
    console.error('bcrypt error', err)
  }

  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const safeUser = { ...user }
  delete safeUser.password
  res.json(safeUser)
})

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Healthy' })
})

// Support POST /api/users/login as alternative login route
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' })
  }

  const db = readDb()
  const users = Array.isArray(db.users) ? db.users : []
  const user = users.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase())
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const stored = user.password || ''
  let ok = false
  try {
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      ok = await bcrypt.compare(password, stored)
    } else {
      ok = password === stored
    }
  } catch (err) {
    console.error('bcrypt error', err)
  }

  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const safeUser = { ...user }
  delete safeUser.password
  res.json(safeUser)
})

// GET /api/users and GET /api/users?email=...
app.get('/api/users', (req, res) => {
  const db = readDb()
  const users = Array.isArray(db.users) ? db.users : []
  const email = req.query.email
  if (email) {
    const found = users.filter((u) => String(u.email).toLowerCase() === String(email).toLowerCase())
    return res.json(found)
  }
  res.json(users)
})

// POST /api/users - register new user (stores hashed password)
app.post('/api/users', async (req, res) => {
  const { name, email, password, role } = req.body || {}
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing name, email or password' })
  }

  const db = readDb()
  db.users = Array.isArray(db.users) ? db.users : []

  const exists = db.users.some((u) => String(u.email).toLowerCase() === String(email).toLowerCase())
  if (exists) {
    return res.status(409).json({ message: 'User already exists' })
  }

  const hash = await bcrypt.hash(password, 10)
  const nextId = db.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1
  const newUser = { id: nextId, name, email, password: hash, role }
  db.users.push(newUser)
  writeDb(db)

  const safeUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
  res.status(201).json(safeUser)
})

// PUT /api/users/:id/change-password - change password
app.put('/api/users/:id/change-password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body || {}
  const userId = parseInt(req.params.id, 10)

  console.log(`[change-password] userId=${userId}, email=${email}`)

  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing email, oldPassword, or newPassword' })
  }

  const db = readDb()
  db.users = Array.isArray(db.users) ? db.users : []
  console.log(`[change-password] Users in db: ${db.users.map((u) => `${u.id}:${u.email}`).join(', ')}`)
  const user = db.users.find((u) => u.id === userId && String(u.email).toLowerCase() === String(email).toLowerCase())
  console.log(`[change-password] Found user: ${user ? 'YES' : 'NO'}`)
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  const stored = user.password || ''
  let oldOk = false
  try {
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      oldOk = await bcrypt.compare(oldPassword, stored)
    } else {
      oldOk = oldPassword === stored
    }
  } catch (err) {
    console.error('bcrypt compare error', err)
  }

  if (!oldOk) {
    return res.status(401).json({ message: 'Old password is incorrect' })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  user.password = newHash
  writeDb(db)

  res.json({ message: 'Password changed successfully' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`)
})

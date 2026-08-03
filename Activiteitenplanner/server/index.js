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

  if (user.blocked) {
    return res.status(403).json({ message: 'User is blocked' })
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
  const { name, email, password, role, firstName, lastName, username, birthDate, country, privacyAccepted } = req.body || {}
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
  const newUser = {
    id: nextId,
    name,
    email,
    password: hash,
    role,
    firstName,
    lastName,
    username,
    birthDate,
    country,
    privacyAccepted: Boolean(privacyAccepted),
    blocked: false,
    favorites: [],
    notifications: [],
  }
  db.users.push(newUser)
  writeDb(db)

  const safeUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    username: newUser.username,
    birthDate: newUser.birthDate,
    country: newUser.country,
    privacyAccepted: newUser.privacyAccepted,
    blocked: newUser.blocked,
    favorites: newUser.favorites,
    notifications: newUser.notifications,
  }
  res.status(201).json(safeUser)
})

app.patch('/api/users/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.users = Array.isArray(db.users) ? db.users : []
  const idx = db.users.findIndex((u) => Number(u.id) === id)
  if (idx < 0) return res.status(404).json({ message: 'Not found' })

  const updates = { ...req.body }
  delete updates.password
  db.users[idx] = { ...db.users[idx], ...updates }
  writeDb(db)

  const safeUser = { ...db.users[idx] }
  delete safeUser.password
  res.json(safeUser)
})

app.delete('/api/users/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.users = Array.isArray(db.users) ? db.users : []
  db.users = db.users.filter((u) => Number(u.id) !== id)
  writeDb(db)
  res.status(204).end()
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

// Basic Activities endpoints (local in-memory via db.json)
app.get('/api/activities', (req, res) => {
  const db = readDb()
  const activities = Array.isArray(db.activities) ? db.activities : []
  res.json(activities)
})

app.post('/api/activities', (req, res) => {
  const db = readDb()
  db.activities = Array.isArray(db.activities) ? db.activities : []

  // Validate location: must be a non-empty, non-whitespace string
  const location = req.body && req.body.location
  if (typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({
      type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
      title: 'Er zijn één of meer validatiefouten opgetreden.',
      status: 400,
      errors: {
        Location: ['Locatie is verplicht', 'Locatie mag niet leeg zijn'],
      },
    })
  }

  const nextId = db.activities.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0) + 1
  const created = { id: nextId, ...req.body }
  db.activities.push(created)
  writeDb(db)
  res.status(201).json(created)
})

app.patch('/api/activities/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.activities = Array.isArray(db.activities) ? db.activities : []
  const idx = db.activities.findIndex((a) => Number(a.id) === id)
  if (idx < 0) return res.status(404).json({ message: 'Not found' })
  // If location is present in the patch body, validate it
  if (Object.prototype.hasOwnProperty.call(req.body, 'location')) {
    const loc = req.body.location
    if (typeof loc !== 'string' || !loc.trim()) {
      return res.status(400).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: 'Er zijn één of meer validatiefouten opgetreden.',
        status: 400,
        errors: {
          Location: ['Locatie is verplicht', 'Locatie mag niet leeg zijn'],
        },
      })
    }
  }

  db.activities[idx] = { ...db.activities[idx], ...req.body }
  writeDb(db)
  res.json(db.activities[idx])
})

app.delete('/api/activities/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.activities = Array.isArray(db.activities) ? db.activities : []
  db.activities = db.activities.filter((a) => Number(a.id) !== id)
  writeDb(db)
  res.status(204).end()
})

// Registrations
app.get('/api/registrations', (req, res) => {
  const db = readDb()
  const regs = Array.isArray(db.registrations) ? db.registrations : []
  res.json(regs)
})

app.post('/api/registrations', (req, res) => {
  const db = readDb()
  db.registrations = Array.isArray(db.registrations) ? db.registrations : []
  const nextId = db.registrations.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1
  const created = { id: nextId, registeredAt: new Date().toISOString(), ...req.body }
  db.registrations.push(created)
  writeDb(db)
  res.status(201).json(created)
})

app.patch('/api/registrations/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.registrations = Array.isArray(db.registrations) ? db.registrations : []
  const idx = db.registrations.findIndex((r) => Number(r.id) === id)
  if (idx < 0) return res.status(404).json({ message: 'Not found' })
  db.registrations[idx] = { ...db.registrations[idx], ...req.body }
  writeDb(db)
  res.json(db.registrations[idx])
})

app.delete('/api/registrations/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.registrations = Array.isArray(db.registrations) ? db.registrations : []
  db.registrations = db.registrations.filter((r) => Number(r.id) !== id)
  writeDb(db)
  res.status(204).end()
})

// Polls
app.get('/api/polls', (req, res) => {
  const db = readDb()
  const polls = Array.isArray(db.polls) ? db.polls : []
  res.json(polls)
})

app.post('/api/polls', (req, res) => {
  const db = readDb()
  db.polls = Array.isArray(db.polls) ? db.polls : []
  const nextId = db.polls.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1
  const timestamp = new Date().toISOString()
  const created = { id: nextId, createdAt: timestamp, updatedAt: timestamp, ...req.body }
  db.polls.push(created)
  writeDb(db)
  res.status(201).json(created)
})

app.patch('/api/polls/:id', (req, res) => {
  const id = Number(req.params.id)
  const db = readDb()
  db.polls = Array.isArray(db.polls) ? db.polls : []
  const idx = db.polls.findIndex((p) => Number(p.id) === id)
  if (idx < 0) return res.status(404).json({ message: 'Not found' })
  db.polls[idx] = { ...db.polls[idx], ...req.body, updatedAt: new Date().toISOString() }
  writeDb(db)
  res.json(db.polls[idx])
})
// Logs
app.get('/api/logs', (req, res) => {
  const db = readDb()
  const logs = Array.isArray(db.logs) ? db.logs : []
  res.json(logs)
})

app.post('/api/logs', (req, res) => {
  const db = readDb()
  db.logs = Array.isArray(db.logs) ? db.logs : []
  const nextId = db.logs.reduce((max, l) => Math.max(max, Number(l.id) || 0), 0) + 1
  const created = { id: nextId, createdAt: new Date().toISOString(), ...req.body }
  db.logs.push(created)
  writeDb(db)
  res.status(201).json(created)
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`)
})

import { useEffect, useState } from 'react'
import './App.css'
import Activiteiten from './Componenten/Activiteiten'
import Layout from './Componenten/Layout'
import ChangePassword from './Componenten/ChangePassword'
import * as api from './api/api'

type UserCredentials = {
  id?: number
  name: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  username?: string
  birthDate?: string
  country?: string
  privacyAccepted?: boolean
  role?: 'admin' | 'bedrijf'
  blocked?: boolean
  favorites?: number[]
  notifications?: string[]
}

type StoredUser = {
  id?: number
  name: string
  email: string
  firstName?: string
  lastName?: string
  username?: string
  birthDate?: string
  country?: string
  privacyAccepted?: boolean
  role?: 'admin' | 'bedrijf'
  blocked?: boolean
  favorites?: number[]
  notifications?: string[]
}

const STORAGE_SESSION = 'industrieon-session-user'
const STORAGE_MOCK_USERS = 'industrieon-mock-users'

function loadMockUsers(): UserCredentials[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const saved = localStorage.getItem(STORAGE_MOCK_USERS)
    if (!saved) {
      return []
    }

    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item) => item && typeof item.email === 'string' && typeof item.password === 'string')
  } catch {
    return []
  }
}

function saveMockUsers(users: UserCredentials[]): void {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(STORAGE_MOCK_USERS, JSON.stringify(users))
}

function getSeedMockUsers(): UserCredentials[] {
  return [
    {
      id: 1,
      name: 'admin',
      email: 'admin@admin.com',
      password: 'admin',
      role: 'admin',
      blocked: false,
      favorites: [],
      notifications: [],
    },
  ]
}

function ensureMockUsers(): UserCredentials[] {
  const current = loadMockUsers()
  if (current.length > 0) {
    return current
  }

  const seeded = getSeedMockUsers()
  saveMockUsers(seeded)
  return seeded
}

function findLocalUser(email: string): UserCredentials | null {
  const normalizedEmail = email.trim().toLowerCase()
  const users = ensureMockUsers()
  return users.find((item) => item.email.toLowerCase() === normalizedEmail) ?? null
}

function loadSessionUser(): UserCredentials | null {
  if (typeof window === 'undefined') {
    return null
  }

  const saved = localStorage.getItem(STORAGE_SESSION)
  if (!saved) {
    return null
  }

  try {
    const parsed = JSON.parse(saved)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.name === 'string' &&
      typeof parsed.email === 'string'
    ) {
      const user: UserCredentials = {
        name: parsed.name,
        email: parsed.email,
        password: '',
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        username: parsed.username,
        birthDate: parsed.birthDate,
        country: parsed.country,
        privacyAccepted: parsed.privacyAccepted,
        role: parsed.role === 'admin' || parsed.role === 'bedrijf' ? parsed.role : undefined,
        blocked: parsed.blocked,
        favorites: parsed.favorites,
        notifications: parsed.notifications,
      }
      ;(user as any).id = parsed.id
      return user
    }
  } catch {
    // ignore invalid stored session
  }

  return null
}

function App() {
  const [user, setUser] = useState<UserCredentials | null>(() => loadSessionUser())
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    async function loadBackendUsers() {
      try {
        await api.getUsers()
      } catch (error) {
        console.warn('Backend gebruikers laden mislukt; lokale mock login is actief.', error)
      }
    }

    loadBackendUsers()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (user) {
      const safeUser: StoredUser = {
        id: (user as any).id,
        name: user.name,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        birthDate: user.birthDate,
        country: user.country,
        privacyAccepted: user.privacyAccepted,
        role: user.role,
        blocked: user.blocked,
        favorites: user.favorites,
        notifications: user.notifications,
      }
      localStorage.setItem(STORAGE_SESSION, JSON.stringify(safeUser))
    } else {
      localStorage.removeItem(STORAGE_SESSION)
    }
  }, [user])

  const handleLogin = async (
    credentials: UserCredentials,
    mode: 'login' | 'register',
  ): Promise<string | undefined> => {
    if (mode === 'login') {
      try {
        const logged = await api.loginUser(credentials.email, credentials.password)
        setUser({ ...(logged as any), password: '' })
        return
      } catch (error) {
        const localUser = findLocalUser(credentials.email)
        if (localUser && localUser.password === credentials.password) {
          setUser({ ...localUser, password: '' })
          return
        }

        const msg = String((error as any)?.message ?? '').toLowerCase()
        if (
          msg.includes('invalid credentials') ||
          msg.includes('ongeldige') ||
          msg.includes('onjuist') ||
          msg.includes('incorrect') ||
          msg.includes('401') ||
          msg.includes('400')
        ) {
          return 'Wachtwoord klopt niet. Probeer het opnieuw.'
        }

        if (msg.includes('500')) {
          return 'Login mislukt door een serverfout (500).'
        }

        if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
          return 'Login mislukt. Controleer je internetverbinding en probeer het opnieuw.'
        }

        if (msg.trim().length > 0) {
          return `Login mislukt: ${String((error as any)?.message ?? '')}`
        }

        return 'Login mislukt. Controleer je internetverbinding en probeer het opnieuw.'
      }
    }

    try {
      const created = await api.createUser(credentials)
      setUser(created)
    } catch (error) {
      const users = ensureMockUsers()
      const normalizedEmail = credentials.email.trim().toLowerCase()
      const existingIndex = users.findIndex((item) => item.email.toLowerCase() === normalizedEmail)

      if (existingIndex >= 0) {
        return 'Er bestaat al een account met dit e-mailadres. Kies inloggen.'
      }

      const localUser: UserCredentials = {
        id: Date.now(),
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
        firstName: credentials.firstName,
        lastName: credentials.lastName,
        username: credentials.username,
        birthDate: credentials.birthDate,
        country: credentials.country,
        privacyAccepted: credentials.privacyAccepted,
        role: credentials.role === 'admin' || credentials.role === 'bedrijf' ? credentials.role : undefined,
        blocked: false,
        favorites: [],
        notifications: [],
      }

      users.push(localUser)
      saveMockUsers(users)
      setUser({ ...localUser, password: '' })
      return

      const message = String((error as any)?.message ?? '')

      if (message.toLowerCase().includes('already exists') || message.includes('409')) {
        return 'Er bestaat al een account met dit e-mailadres. Kies inloggen.'
      }

      if (message.trim().length > 0) {
        return `Registreren mislukt: ${message}`
      }

      return 'Registreren mislukt. Controleer de backend en probeer het opnieuw.'
    }
  }

  return showChangePassword && user ? (
    <ChangePassword
      user={user}
      onSuccess={() => {
        setShowChangePassword(false)
        alert('Wachtwoord succesvol gewijzigd!')
      }}
      onCancel={() => setShowChangePassword(false)}
    />
  ) : (
    <Layout>
      <Activiteiten
        user={user}
        onLogin={handleLogin}
        onLogout={() => {
          api.logoutUser()
          setUser(null)
        }}
        onShowChangePassword={() => setShowChangePassword(true)}
      />
    </Layout>
  )
}

export default App

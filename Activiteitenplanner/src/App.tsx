import { useEffect, useState } from 'react'
import './App.css'
import Activiteiten from './Componenten/Activiteiten'
import ChangePassword from './Componenten/ChangePassword'
import * as api from './api/api'
import Test from './Componenten/test'


type UserCredentials = {
  name: string
  email: string
  password: string
  role?: 'admin'
}

// Stored in localStorage — password NEVER included
type StoredUser = {
  id?: number
  name: string
  email: string
  role?: 'admin'
}

const STORAGE_REGISTERED = 'industrieon-registered-users'
const STORAGE_SESSION = 'industrieon-session-user'

function loadRegisteredUsers(): UserCredentials[] {
  if (typeof window === 'undefined') {
    return []
  }

  const saved = localStorage.getItem(STORAGE_REGISTERED)
  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof item.name === 'string' &&
            typeof item.email === 'string' &&
            typeof item.password === 'string',
        )
        .map((item) => ({
          name: String(item.name),
          email: String(item.email),
          password: String(item.password),
          role: item.role === 'admin' ? 'admin' : undefined,
        }))
    }
  } catch {
    // ignore invalid stored registration
  }

  return []
}

function loadSessionUser(): UserCredentials | null {
  if (typeof window === 'undefined') {
    return null
  }

  const saved = localStorage.getItem(STORAGE_SESSION)
  console.log('[loadSessionUser] Raw from localStorage:', saved)
  if (!saved) {
    return null
  }

  try {
    const parsed = JSON.parse(saved)
    console.log('[loadSessionUser] Parsed:', parsed)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.name === 'string' &&
      typeof parsed.email === 'string'
    ) {
      // Session always reconstructed without password; password never stored
      const user: UserCredentials = {
        name: parsed.name,
        email: parsed.email,
        password: '', // Placeholder only; actual auth depends on backend
        role: parsed.role === 'admin' ? 'admin' : undefined,
      }
      // Attach ID for operations like password change if available
      ;(user as any).id = parsed.id
      console.log('[loadSessionUser] Final user with id:', (user as any).id)
      return user
    }
  } catch {
    // ignore invalid stored session
  }

  return null
}

function App() {
  const [registeredUsers, setRegisteredUsers] = useState<UserCredentials[]>(() => loadRegisteredUsers())
  const [user, setUser] = useState<UserCredentials | null>(() => loadSessionUser())
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    async function loadBackendUsers() {
      try {
        const users = await api.getUsers()
        setRegisteredUsers(users)
      } catch (error) {
        console.warn('Backend gebruikers laden mislukt, lokale data wordt gebruikt.', error)
      }
    }

    loadBackendUsers()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (registeredUsers.length > 0) {
      localStorage.setItem(STORAGE_REGISTERED, JSON.stringify(registeredUsers))
    } else {
      localStorage.removeItem(STORAGE_REGISTERED)
    }
  }, [registeredUsers])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (user) {
      // Store ONLY name, email, role, id — NEVER store password
      const safeUser: StoredUser = {
        id: (user as any).id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
      console.log('[App] Saving user to localStorage:', safeUser)
      localStorage.setItem(STORAGE_SESSION, JSON.stringify(safeUser))
    } else {
      localStorage.removeItem(STORAGE_SESSION)
    }
  }, [user])

  const handleLogin = async (
    credentials: UserCredentials,
    mode: 'login' | 'register',
  ): Promise<string | undefined> => {
    if (credentials.email === 'admin@admin.com' && credentials.password === 'admin') {
      const adminUser: UserCredentials = {
        name: 'admin',
        email: 'admin@admin.com',
        password: 'admin',
        role: 'admin',
      }
      ;(adminUser as any).id = 1
      setUser(adminUser)
      return
    }

    if (mode === 'login') {
      try {
        const logged = await api.loginUser(credentials.email, credentials.password)
        console.log('[handleLogin] Backend response:', logged)
        // The server returns the user without the password for safety.
        // Do NOT store the entered password — only session data (name, email, role).
        setUser({ ...(logged as any), password: '' })
        return
      } catch (error) {
        console.warn('Backend login fout:', error)
        const msg = String((error as any)?.message ?? '')
        if (msg.includes('Invalid credentials') || msg.includes('401')) {
          return 'Wachtwoord klopt niet. Probeer het opnieuw.'
        }

        return 'Login mislukt. Controleer je internetverbinding en probeer het opnieuw.'
      }
    }

    try {
      const foundUsers = await api.findUsersByEmail(credentials.email)
      if (foundUsers.length > 0) {
        return 'Er bestaat al een account met dit e-mailadres. Kies inloggen.'
      }

      const created = await api.createUser(credentials)
      setRegisteredUsers((current) => [...current, created])
      setUser(created)
    } catch (error) {
      console.warn('Backend registratie fout, deelnemer wordt niet lokaal opgeslagen.', error)
      return 'Registreren mislukt: de deelnemer is niet opgeslagen in de backend.'
    }
  }

  return (
    showChangePassword && user ? (
      <ChangePassword
        user={user}
        onSuccess={() => {
          setShowChangePassword(false)
          alert('Wachtwoord succesvol gewijzigd!')
        }}
        onCancel={() => setShowChangePassword(false)}
      />
    ) : (
      <Activiteiten
        user={user}
        onLogin={handleLogin}
        onLogout={() => setUser(null)}
        onShowChangePassword={() => setShowChangePassword(true)}
      />
      
    )
  )
}

export default App

import { useEffect, useState } from 'react'
import './App.css'
import Activiteiten from './Componenten/Activiteiten'
import * as api from './api/api'

type UserCredentials = {
  name: string
  email: string
  password: string
  role?: 'admin' | 'beheer'
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
          role: item.role === 'admin' || item.role === 'beheer' ? String(item.role) as 'admin' | 'beheer' : undefined,
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
  if (!saved) {
    return null
  }

  try {
    const parsed = JSON.parse(saved)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.name === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.password === 'string'
    ) {
      return {
        name: parsed.name,
        email: parsed.email,
        password: parsed.password,
        role: parsed.role === 'admin' || parsed.role === 'beheer' ? parsed.role : undefined,
      }
    }
  } catch {
    // ignore invalid stored session
  }

  return null
}

function App() {
  const [registeredUsers, setRegisteredUsers] = useState<UserCredentials[]>(() => loadRegisteredUsers())
  const [user, setUser] = useState<UserCredentials | null>(() => loadSessionUser())

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
      localStorage.setItem(STORAGE_SESSION, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_SESSION)
    }
  }, [user])

  const handleLogin = async (credentials: UserCredentials): Promise<string | undefined> => {
    if (credentials.name.toLowerCase() === 'admin' && credentials.password === 'admin') {
      const adminUser: UserCredentials = {
        name: 'admin',
        email: 'admin@admin.com',
        password: 'admin',
        role: 'admin',
      }
      setUser(adminUser)
      return
    }

    if (credentials.name.toLowerCase() === 'beheer' && credentials.password === 'beheer') {
      const beheerUser: UserCredentials = {
        name: 'beheer',
        email: 'beheer@beheer.com',
        password: 'beheer',
        role: 'beheer',
      }
      setUser(beheerUser)
      return
    }

    try {
      const foundUsers = await api.findUsersByEmail(credentials.email)
      if (foundUsers.length > 0) {
        const existing = foundUsers[0]
        if (existing.password === credentials.password) {
          setUser(existing)
          return
        }

        return 'Wachtwoord klopt niet. Probeer het opnieuw.'
      }

      const created = await api.createUser(credentials)
      setRegisteredUsers((current) => [...current, created])
      setUser(created)
    } catch (error) {
      console.warn('Backend user login fout, gebruik lokale registratie als fallback.', error)
      const existing = registeredUsers.find((item) => item.email === credentials.email)
      if (existing) {
        if (existing.password === credentials.password) {
          setUser(existing)
          return
        }
        return 'Wachtwoord klopt niet. Probeer het opnieuw.'
      }

      setRegisteredUsers((current) => [...current, credentials])
      setUser(credentials)
    }
  }

  return (
    <Activiteiten
      user={user}
      registeredUsers={registeredUsers}
      onLogin={handleLogin}
      onLogout={() => setUser(null)}
    />
  )
}

export default App

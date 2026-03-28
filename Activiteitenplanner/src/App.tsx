import { useEffect, useState } from 'react'
import './App.css'
import Activiteiten from './Componenten/Activiteiten'

type UserCredentials = {
  name: string
  email: string
}

const STORAGE_REGISTERED = 'industrieon-registered-user'
const STORAGE_SESSION = 'industrieon-session-user'

function loadRegisteredUser(): UserCredentials | null {
  if (typeof window === 'undefined') {
    return null
  }

  const saved = localStorage.getItem(STORAGE_REGISTERED)
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
      return { name: parsed.name, email: parsed.email }
    }
  } catch {
    // ignore invalid stored registration
  }

  return null
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
      return { name: parsed.name, email: parsed.email }
    }
  } catch {
    // ignore invalid stored session
  }

  return null
}

function App() {
  const [registeredUser, setRegisteredUser] = useState<UserCredentials | null>(() => loadRegisteredUser())
  const [user, setUser] = useState<UserCredentials | null>(() => loadSessionUser())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (registeredUser) {
      localStorage.setItem(STORAGE_REGISTERED, JSON.stringify(registeredUser))
    }
  }, [registeredUser])

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

  const handleLogin = (credentials: UserCredentials) => {
    if (
      registeredUser &&
      registeredUser.name === credentials.name &&
      registeredUser.email === credentials.email
    ) {
      setUser(credentials)
      return
    }

    setRegisteredUser(credentials)
    setUser(credentials)
  }

  return (
    <Activiteiten
      user={user}
      onLogin={handleLogin}
      onLogout={() => setUser(null)}
    />
  )
}

export default App

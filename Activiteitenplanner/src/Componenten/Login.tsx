import { type FormEvent, useState } from 'react'
import './Login.css'

type UserCredentials = {
  name: string
  email: string
  password: string
}

type LoginProps = {
  onLogin: (credentials: UserCredentials, mode: 'login' | 'register') => Promise<string | undefined>
  onCancel: () => void
  error?: string
}

function Login({ onLogin, onCancel, error }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError('')

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (mode === 'register' && (!trimmedName || !trimmedEmail || !trimmedPassword)) {
      setValidationError('Vul naam, e-mail en wachtwoord in om te registreren.')
      return
    }

    if (mode === 'login' && (!trimmedEmail || !trimmedPassword)) {
      setValidationError('Vul e-mail en wachtwoord in om in te loggen.')
      return
    }

    const isAdminLogin = trimmedEmail === 'admin@admin.com' && trimmedPassword === 'admin'

    onLogin({
      name: mode === 'register' ? trimmedName : trimmedName,
      email: isAdminLogin ? 'admin@admin.com' : trimmedEmail,
      password: trimmedPassword,
    }, mode)
  }

  const handleCancel = () => {
    setName('')
    setEmail('')
    setPassword('')
    onCancel()
  }

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="login-topbar-brand">IndustrieON</div>
      </header>
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">IndustrieON</div>
        </div>

        <h1>{mode === 'login' ? 'Inloggen' : 'Registreren'}</h1>
        <p className="login-subtitle">
          {mode === 'login'
            ? 'Gebruik je e-mailadres en wachtwoord om in te loggen als bestaande deelnemer.'
            : 'Maak een nieuw account aan door je naam, e-mail en wachtwoord in te vullen.'}
        </p>

        <div className="login-mode-switch" role="tablist" aria-label="Authenticatie modus">
          <button
            type="button"
            className={`login-mode-button ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setValidationError('')
            }}
          >
            Ik heb al een account
          </button>
          <button
            type="button"
            className={`login-mode-button ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register')
              setValidationError('')
            }}
          >
            Ik ben nieuw
          </button>
        </div>

        <p className="login-note">
          Admin-login: e-mail <strong>admin@admin.com</strong> en wachtwoord <strong>admin</strong>.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label htmlFor="login-name">Naam</label>
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Vul je naam in"
              />
            </>
          )}

          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Vul je e-mail in"
          />

          <label htmlFor="login-password">Wachtwoord</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Vul je wachtwoord in"
          />

          {validationError ? <div className="login-error">{validationError}</div> : null}
          {error ? <div className="login-error">{error}</div> : null}

          <div className="login-actions">
            <button className="login-button primary" type="submit">
              {mode === 'login' ? 'Inloggen' : 'Registreren'}
            </button>
            <button className="login-button secondary" type="button" onClick={handleCancel}>
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login

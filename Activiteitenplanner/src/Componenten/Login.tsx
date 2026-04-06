import { type FormEvent, useState } from 'react'
import './Login.css'

type UserCredentials = {
  name: string
  email: string
  password: string
}

type LoginProps = {
  onLogin: (credentials: UserCredentials) => Promise<string | undefined>
  onCancel: () => void
  error?: string
}

function Login({ onLogin, onCancel, error }: LoginProps) {
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

    const isAdminOrBeheerLogin =
      (trimmedName === 'admin' && trimmedPassword === 'admin') ||
      (trimmedName === 'beheer' && trimmedPassword === 'beheer')

    if (!trimmedName || !trimmedPassword || (!isAdminOrBeheerLogin && !trimmedEmail)) {
      setValidationError('Vul naam, e-mail en wachtwoord correct in.')
      return
    }

    const defaultEmail =
      trimmedName === 'beheer'
        ? 'beheer@beheer.com'
        : trimmedName === 'admin'
        ? 'admin@admin.com'
        : trimmedEmail

    onLogin({
      name: trimmedName,
      email: trimmedEmail || defaultEmail,
      password: trimmedPassword,
    })
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

        <h1>Inloggen / registreren</h1>
        <p className="login-subtitle">
          Vul je naam, e-mail en wachtwoord in om in te loggen of te registreren.
          Een nieuw account wordt aangemaakt als je nog niet eerder geregistreerd bent.
        </p>
        <p className="login-note">
          Voor admin-login gebruik: naam <strong>admin</strong>, e-mail <strong>admin@admin.com</strong> en wachtwoord <strong>admin</strong>.
          Voor beheer-login gebruik: naam <strong>beheer</strong>, e-mail <strong>beheer@beheer.com</strong> en wachtwoord <strong>beheer</strong>.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-name">Naam</label>
          <input
            id="login-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Vul je naam in"
          />

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
              Inloggen
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

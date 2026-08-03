import { type FormEvent, useState } from 'react'
import './Login.css'

type UserCredentials = {
  name: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  username?: string
  birthDate?: string
  country?: string
  privacyAccepted?: boolean
  role?: 'bedrijf'
}

type LoginProps = {
  onLogin: (credentials: UserCredentials, mode: 'login' | 'register') => Promise<string | undefined>
  onCancel: () => void
  error?: string
}

function Login({ onLogin, onCancel, error }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [country, setCountry] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [accountType, setAccountType] = useState<'user' | 'bedrijf'>('user')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    const payload = mode === 'register'
      ? (
          firstName.trim() || lastName.trim() || username.trim() || birthDate || country.trim() || privacyAccepted
            ? {
                name: trimmedName,
                email: isAdminLogin ? 'admin@admin.com' : trimmedEmail,
                password: trimmedPassword,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                username: username.trim(),
                birthDate,
                country: country.trim(),
                privacyAccepted,
                ...(accountType === 'bedrijf' ? { role: 'bedrijf' as const } : {}),
              }
            : {
                name: trimmedName,
                email: isAdminLogin ? 'admin@admin.com' : trimmedEmail,
                password: trimmedPassword,
                ...(accountType === 'bedrijf' ? { role: 'bedrijf' as const } : {}),
              }
        )
      : {
          name: trimmedName,
          email: isAdminLogin ? 'admin@admin.com' : trimmedEmail,
          password: trimmedPassword,
        }

    const error = await onLogin(payload, mode)

    if (error) {
      setValidationError(error)
    }
  }

  const handleCancel = () => {
    setName('')
    setFirstName('')
    setLastName('')
    setUsername('')
    setEmail('')
    setPassword('')
    setBirthDate('')
    setCountry('')
    setPrivacyAccepted(false)
    setAccountType('user')
    onCancel()
  }

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="login-topbar-brand">Tools</div>
      </header>
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">Tools</div>
        </div>

        <h1>{mode === 'login' ? 'Inloggen' : 'Registreren'}</h1>
        <p className="login-subtitle">
          {mode === 'login'
            ? 'Gebruik je e-mailadres en wachtwoord om in te loggen als gast, gebruiker, bedrijf of admin.'
            : 'Maak een account aan voor gebruiker of bedrijf. Alleen noodzakelijke gegevens worden gevraagd.'}
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
              <label htmlFor="login-account-type">Accounttype</label>
              <select
                id="login-account-type"
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as 'user' | 'bedrijf')}
              >
                <option value="user">User</option>
                <option value="bedrijf">Bedrijf</option>
              </select>
              <div className="login-form-grid">
                <div>
                  <label htmlFor="login-first-name">Voornaam</label>
                  <input
                    id="login-first-name"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Voornaam"
                  />
                </div>
                <div>
                  <label htmlFor="login-last-name">Achternaam</label>
                  <input
                    id="login-last-name"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Achternaam"
                  />
                </div>
              </div>
              <label htmlFor="login-name">Naam</label>
              <input
                id="login-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Vul je naam in"
              />
              <label htmlFor="login-username">Gebruikersnaam</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Kies een gebruikersnaam"
              />
            </>
          )}

          {mode === 'register' && (
            <>
              <label htmlFor="login-birth-date">Geboortedatum</label>
              <input
                id="login-birth-date"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
              />

              <label htmlFor="login-country">Land</label>
              <input
                id="login-country"
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Bijv. Nederland"
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

          {mode === 'register' && (
            <label className="login-checkbox">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
              />
              Ik ga akkoord met de privacyverklaring en algemene voorwaarden.
            </label>
          )}

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

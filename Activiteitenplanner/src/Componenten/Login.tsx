import { type FormEvent, useState } from 'react'
import './Login.css'

type UserCredentials = {
  name: string
  email: string
}

type LoginProps = {
  onLogin: (credentials: UserCredentials) => void
  onCancel: () => void
}

function Login({ onLogin, onCancel }: LoginProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !email.trim()) {
      return
    }

    onLogin({ name: name.trim(), email: email.trim() })
  }

  const handleCancel = () => {
    setName('')
    setEmail('')
    onCancel()
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">LOGO</div>
        </div>

        <h1>Inloggen / registreren</h1>
        <p className="login-subtitle">
          Vul je naam en e-mail in om in te loggen als je eerder geregistreerd bent.
          Anders wordt er een nieuw account aangemaakt.
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

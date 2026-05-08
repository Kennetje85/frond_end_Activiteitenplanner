import { type FormEvent, useState } from 'react'
import './Login.css'
import * as api from '../api/api'

type ChangePasswordProps = {
  user: { name: string; email: string; id?: number }
  onSuccess: () => void
  onCancel: () => void
}

function ChangePassword({ user, onSuccess, onCancel }: ChangePasswordProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const trimmedOld = oldPassword.trim()
    const trimmedNew = newPassword.trim()
    const trimmedConfirm = confirmPassword.trim()

    if (!trimmedOld || !trimmedNew || !trimmedConfirm) {
      setError('Vul alle velden in.')
      return
    }

    if (trimmedNew !== trimmedConfirm) {
      setError('Nieuwe wachtwoorden komen niet overeen.')
      return
    }

    if (trimmedNew.length < 4) {
      setError('Nieuw wachtwoord moet minstens 4 tekens zijn.')
      return
    }

    if (trimmedOld === trimmedNew) {
      setError('Nieuw wachtwoord moet anders zijn dan het huidige.')
      return
    }

    setIsLoading(true)
    try {
      console.log('[ChangePassword] Submitting with:', { userId: user.id ?? 0, email: user.email })
      await api.changePassword(
        user.id ?? 0,
        user.email,
        trimmedOld,
        trimmedNew,
      )
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onSuccess()
    } catch (err) {
      const msg = String((err as any)?.message ?? '')
      if (msg.includes('Old password is incorrect') || msg.includes('401')) {
        setError('Huidig wachtwoord is incorrect.')
      } else if (msg.includes('User not found') || msg.includes('404')) {
        setError('Gebruiker niet gevonden.')
      } else {
        setError('Wachtwoord wijzigen mislukt. Probeer het opnieuw.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <header className="login-topbar">
        <div className="login-topbar-brand">IndustrieON</div>
      </header>
      <div className="login-card">
        <h1>Wachtwoord wijzigen</h1>
        <p className="login-subtitle">
          Voer je huidige wachtwoord in en kies een nieuw wachtwoord.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="old-password">Huidig wachtwoord</label>
          <input
            id="old-password"
            type="password"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            placeholder="Voer je huidige wachtwoord in"
            disabled={isLoading}
          />

          <label htmlFor="new-password">Nieuw wachtwoord</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Voer je nieuwe wachtwoord in"
            disabled={isLoading}
          />

          <label htmlFor="confirm-password">Nieuw wachtwoord bevestigen</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Bevestig je nieuwe wachtwoord"
            disabled={isLoading}
          />

          {error ? <div className="login-error">{error}</div> : null}

          <div className="login-actions">
            <button className="login-button primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Bezig...' : 'Wachtwoord wijzigen'}
            </button>
            <button
              className="login-button secondary"
              type="button"
              onClick={onCancel}
              disabled={isLoading}
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangePassword

import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Login from './Login'

describe('Login component', () => {
  it('shows a validation error when login fields are missing', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

    await user.click(getByRole('button', { name: 'Inloggen' }))

    expect(getByText('Vul e-mail en wachtwoord in om in te loggen.')).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('submits admin login with admin email and password', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByLabelText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

    await user.type(getByLabelText('E-mail'), 'admin@admin.com')
    await user.type(getByLabelText('Wachtwoord'), 'admin')
    await user.click(getByRole('button', { name: 'Inloggen' }))

    expect(onLogin).toHaveBeenCalledWith({
      email: 'admin@admin.com',
      password: 'admin',
      name: '',
    }, 'login')
  })

  it('switches to register mode and requires name, email and password', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByLabelText, getByText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

    await user.click(getByRole('button', { name: 'Ik ben nieuw' }))
    await user.click(getByRole('button', { name: 'Registreren' }))

    expect(getByText('Vul naam, e-mail en wachtwoord in om te registreren.')).toBeInTheDocument()

    await user.type(getByLabelText('Naam'), 'Ken')
    await user.type(getByLabelText('E-mail'), 'ken@example.com')
    await user.type(getByLabelText('Wachtwoord'), '1234')
    await user.click(getByRole('button', { name: 'Registreren' }))

    expect(onLogin).toHaveBeenCalledWith(
      { name: 'Ken', email: 'ken@example.com', password: '1234' },
      'register',
    )
  })

  it('clears the form when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByLabelText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

    await user.click(getByRole('button', { name: 'Ik ben nieuw' }))
    await user.type(getByLabelText('Naam'), 'Ken')
    await user.type(getByLabelText('E-mail'), 'ken@example.com')
    await user.type(getByLabelText('Wachtwoord'), '1234')
    await user.click(getByRole('button', { name: 'Annuleren' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(getByLabelText('Naam')).toHaveValue('')
    expect(getByLabelText('E-mail')).toHaveValue('')
    expect(getByLabelText('Wachtwoord')).toHaveValue('')
  })
})

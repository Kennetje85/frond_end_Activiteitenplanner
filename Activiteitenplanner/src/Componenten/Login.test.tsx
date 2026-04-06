import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Login from './Login'

describe('Login component', () => {
  it('shows a validation error when required fields are missing', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

    await user.click(getByRole('button', { name: 'Inloggen' }))

    expect(getByText('Vul naam, e-mail en wachtwoord correct in.')).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('submits admin login without requiring email', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByLabelText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

    await user.type(getByLabelText('Naam'), 'admin')
    await user.type(getByLabelText('Wachtwoord'), 'admin')
    await user.click(getByRole('button', { name: 'Inloggen' }))

    expect(onLogin).toHaveBeenCalledWith({
      name: 'admin',
      email: 'admin@admin.com',
      password: 'admin',
    })
  })

  it('clears the form when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn().mockResolvedValue(undefined)
    const onCancel = vi.fn()

    const { getByRole, getByLabelText } = render(<Login onLogin={onLogin} onCancel={onCancel} />)

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

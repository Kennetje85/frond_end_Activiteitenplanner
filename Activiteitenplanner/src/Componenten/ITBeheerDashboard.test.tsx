import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ITBeheerDashboard from './ITBeheerDashboard'

describe('ITBeheerDashboard component', () => {
  it('shows api status and user summary', () => {
    render(
      <ITBeheerDashboard
        registeredUsers={[
          { name: 'admin', email: 'admin@admin.com' },
          { name: 'beheer', email: 'beheer@beheer.com' },
        ]}
        activiteiten={[
          { title: 'A', participants: 2, participantsList: ['Ken', 'Sara'] },
          { title: 'B', participants: 1, participantsList: ['Tom'] },
        ]}
        logs={['Log 1', 'Log 2']}
        apiStatus={true}
      />,
    )

    expect(screen.getByText('IT Beheer Dashboard')).toBeInTheDocument()
    expect(screen.getByText('API: OK')).toBeInTheDocument()
      expect(screen.getAllByText('2', { selector: 'strong' })).toHaveLength(2)
      expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument()
  })
})

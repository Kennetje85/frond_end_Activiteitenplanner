import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ActiviteitenDetails from './ActiviteitenDetails'

describe('ActiviteitenDetails component', () => {
  const activiteit = {
    title: 'Workshop IoT',
    description: 'Testbeschrijving',
    date: '12 mei 2026',
    time: '14:00 - 16:00',
    location: 'IndustrieON HQ',
    participants: 1,
    participantsList: ['Ken'],
    image: '',
  }

  it('shows the current participation status and rating buttons', () => {
    const { getByRole, getByText } = render(
      <ActiviteitenDetails
        activiteit={activiteit}
        user={{ name: 'Ken', email: 'ken@example.com' }}
        onBack={vi.fn()}
        onSelectStatusChoice={vi.fn()}
        onRegister={vi.fn()}
        onLeave={vi.fn()}
        onRate={vi.fn()}
        isRegistered={true}
        selectedStatusChoice="zeker"
        userStatus="zeker"
        statusCounts={{ zeker: 1, misschien: 0, niet: 0 }}
        totalResponses={1}
        userRating={5}
        averageRating={5}
        totalRatings={1}
      />,
    )

    expect(getByText('Inschrijfstatus')).toBeInTheDocument()
    expect(getByRole('button', { name: 'Zeker' })).toBeInTheDocument()
    expect(getByRole('button', { name: 'Status opslaan' })).toBeInTheDocument()
    expect(getByRole('button', { name: '5' })).toBeInTheDocument()
  })

  it('calls the selected status handler when a status button is clicked', async () => {
    const user = userEvent.setup()
    const onSelectStatusChoice = vi.fn()

    const { getByRole } = render(
      <ActiviteitenDetails
        activiteit={activiteit}
        user={{ name: 'Ken', email: 'ken@example.com' }}
        onBack={vi.fn()}
        onSelectStatusChoice={onSelectStatusChoice}
        onRegister={vi.fn()}
        onLeave={vi.fn()}
        onRate={vi.fn()}
        isRegistered={false}
        selectedStatusChoice="zeker"
        userStatus={null}
        statusCounts={{ zeker: 0, misschien: 0, niet: 0 }}
        totalResponses={0}
        userRating={null}
        averageRating={null}
        totalRatings={0}
      />,
    )

    await user.click(getByRole('button', { name: 'Misschien' }))

    expect(onSelectStatusChoice).toHaveBeenCalledWith('misschien')
  })
})

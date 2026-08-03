import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ActiviteitenDetails from './ActiviteitenDetails'

describe('ActiviteitenDetails component', () => {
  // Voorbeeldactiviteit die in beide tests wordt hergebruikt.
  const activiteit = {
    title: 'Workshop IoT',
    description: 'Testbeschrijving',
    date: '12 mei 2027',
    time: '14:00 - 16:00',
    location: 'IndustrieON HQ',
    participants: 1,
    participantsList: ['Ken'],
    image: '',
  }

  it('shows the current participation status and rating buttons', () => {
    // Deze test controleert of de belangrijkste knoppen en tekst zichtbaar zijn.
    const { getByRole, getByText } = render(
      <ActiviteitenDetails
        activiteit={activiteit}
        user={{ name: 'Ken', email: 'ken@example.com' }}
        onBack={vi.fn()}
        onSelectStatusChoice={vi.fn()}
        onRegister={vi.fn()}
        onLeave={vi.fn()}
        onRate={vi.fn()}
        onEditActivity={vi.fn()}
        onDeleteActivity={vi.fn()}
        canEditActivity={false}
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
    // Deze test controleert of een klik op de statusknop het juiste callback-argument doorgeeft.
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
        onEditActivity={vi.fn()}
        onDeleteActivity={vi.fn()}
        canEditActivity={false}
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

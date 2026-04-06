import './ActiviteitenDetails.css'

type Activiteit = {
  title: string
  description: string
  date: string
  time: string
  location: string
  participants: number
  participantsList: string[]
  image: string
}

type UserCredentials = {
  name: string
  email: string
}

type ParticipationStatus = 'zeker' | 'misschien' | 'niet'

type ActiviteitenDetailsProps = {
  activiteit: Activiteit
  user: UserCredentials | null
  onBack: () => void
  onSelectStatusChoice: (value: ParticipationStatus) => void
  onRegister: () => void
  onLeave: () => void
  onRate: (rating: number) => void
  isRegistered: boolean
  selectedStatusChoice: ParticipationStatus
  userStatus: ParticipationStatus | null
  statusCounts: {
    zeker: number
    misschien: number
    niet: number
  }
  totalResponses: number
  userRating: number | null
  averageRating: number | null
  totalRatings: number
}

function ActiviteitenDetails({
  activiteit,
  user,
  onBack,
  onSelectStatusChoice,
  onRegister,
  onLeave,
  onRate,
  isRegistered,
  selectedStatusChoice,
  userStatus,
  statusCounts,
  totalResponses,
  userRating,
  averageRating,
  totalRatings,
}: ActiviteitenDetailsProps) {
  return (
    <section className="activiteiten-details">
      <div className="details-toolbar">
        <button className="details-back-button" type="button" onClick={onBack}>
          Terug naar activiteiten
        </button>
      </div>

      <div className="details-panel">
        {activiteit.image && (
          <div className="details-image-wrap">
            <img src={activiteit.image} alt={activiteit.title} />
          </div>
        )}
        <div className="details-header">
          <h1>{activiteit.title}</h1>
        </div>

        <div className="details-meta">
          <span>{activiteit.date} / {activiteit.time}</span>
        </div>

        <div className="details-body">
          <div className="details-description">
            <h2>Omschrijving</h2>
            <p>{activiteit.description}</p>
          </div>

          <div className="details-summary">
            <div className="summary-row">
              <span className="summary-label">Aantal deelnemers:</span>
              <span className="summary-value">{activiteit.participants}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Locatie info:</span>
              <span className="summary-value">{activiteit.location}</span>
            </div>
          </div>

          <div className="details-participants">
            <h2>Ingeschreven deelnemers</h2>
            {activiteit.participantsList.length > 0 ? (
              <ul>
                {activiteit.participantsList.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : (
              <p>Er zijn nog geen deelnemers ingeschreven.</p>
            )}
          </div>
        </div>

        <div className="details-poll">
          <h2>Inschrijfstatus</h2>
          <p>Kies eerst je status en klik daarna op inschrijven.</p>
          <p>
            Zeker: {statusCounts.zeker} | Misschien: {statusCounts.misschien} | Niet: {statusCounts.niet}
            {' '}({totalResponses} reactie{totalResponses === 1 ? '' : 's'})
          </p>
          <div className="details-poll-buttons">
            {([
              { value: 'zeker', label: 'Zeker' },
              { value: 'misschien', label: 'Misschien' },
              { value: 'niet', label: 'Niet' },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                className={`details-poll-button ${selectedStatusChoice === option.value ? 'active' : ''}`}
                onClick={() => onSelectStatusChoice(option.value)}
                disabled={!user}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="details-actions">
            <button className="details-action-button" type="button" onClick={onRegister} disabled={!user}>
              {isRegistered ? 'Status opslaan' : 'Inschrijven'}
            </button>
            <button
              className="details-action-button details-action-secondary"
              type="button"
              onClick={onLeave}
              disabled={!user || !isRegistered}
            >
              Uitschrijven
            </button>
          </div>
          {userStatus !== null ? <p className="details-poll-note">Jouw keuze: {userStatus}</p> : null}
        </div>

        <div className="details-poll">
          <h2>Tevredenheidspoll (1 t/m 5)</h2>
          <p>Gemiddelde score: {averageRating ?? '-'} / 5 ({totalRatings} stem{totalRatings === 1 ? '' : 'men'})</p>
          <div className="details-rating-buttons">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`details-rating-button ${userRating === value ? 'active' : ''}`}
                onClick={() => onRate(value)}
                disabled={!user || !isRegistered}
              >
                {value}
              </button>
            ))}
          </div>
          {userRating !== null ? <p className="details-poll-note">Jouw stem: {userRating}/5</p> : null}
          {user && !isRegistered ? (
            <p className="details-poll-note">Je kunt pas stemmen nadat je bent ingeschreven.</p>
          ) : null}
        </div>

        {!user && (
          <p className="details-note">Je moet eerst aanmelden om je in te schrijven en te stemmen.</p>
        )}
      </div>
    </section>
  )
}

export default ActiviteitenDetails

import './ActiviteitenDetails.css'

type Activiteit = {
  title: string
  description: string
  date: string
  time: string
  location: string
  participants: number
  image: string
}

type UserCredentials = {
  name: string
  email: string
}

type ActiviteitenDetailsProps = {
  activiteit: Activiteit
  user: UserCredentials | null
  isJoined: boolean
  onBack: () => void
  onJoin: () => void
  onLeave: () => void
}

function ActiviteitenDetails({
  activiteit,
  user,
  isJoined,
  onBack,
  onJoin,
  onLeave,
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
        </div>

        <div className="details-actions">
          <button
            className="details-action-button"
            type="button"
            onClick={onJoin}
            disabled={!user || isJoined}
          >
            Inschrijven
          </button>
          <button
            className="details-action-button details-action-secondary"
            type="button"
            onClick={onLeave}
            disabled={!user || !isJoined}
          >
            Uitschrijven
          </button>
        </div>

        {!user && (
          <p className="details-note">Je moet eerst aanmelden om deel te nemen aan deze activiteit.</p>
        )}
      </div>
    </section>
  )
}

export default ActiviteitenDetails

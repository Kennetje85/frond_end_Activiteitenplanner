import './ActiviteitenDashboard.css'

type DashboardActivity = {
  id?: number
  title: string
  category?: string
  status?: string
  participants: number
  maxParticipants?: number
  participantsList: string[]
  createdBy?: string
}

type DashboardPoll = {
  id?: number
  activityId: number
  rating: number
  createdAt?: string
}

type ActiviteitenDashboardProps = {
  activiteiten: DashboardActivity[]
  activeIndex: number
  onSelectActivity: (index: number) => void
  canEditSelectedActivity: boolean
  onEditActivity: () => void
  onDeleteActivity: () => void
  onNewActivity: () => void
  onExportData: () => void
  polls?: DashboardPoll[]
}

function ActiviteitenDashboard({
  activiteiten,
  activeIndex,
  onSelectActivity,
  canEditSelectedActivity,
  onEditActivity,
  onDeleteActivity,
  onNewActivity,
  onExportData,
  polls = [],
}: ActiviteitenDashboardProps) {
  const visibleActivities = activiteiten
  const selected = visibleActivities[activeIndex] || null

  const getActivityPollStats = (activityId: number | undefined) => {
    if (!activityId) return { averageRating: null, totalRatings: 0 }
    const activityPolls = polls.filter((poll) => poll.activityId === activityId)
    if (activityPolls.length === 0) return { averageRating: null, totalRatings: 0 }
    const avg = Number(
      (activityPolls.reduce((sum, poll) => sum + poll.rating, 0) / activityPolls.length).toFixed(1),
    )
    return { averageRating: avg, totalRatings: activityPolls.length }
  }

  return (
    <section className="dashboard-panel">
      <div className="dashboard-hero">
        <div className="dashboard-logo"></div>
      </div>
      <div className="dashboard-header">
        <h2>Dashboard</h2>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-list">
          <div className="dashboard-list-title">Activiteiten</div>
          {visibleActivities.length > 0 ? (
            visibleActivities.map((activity, index) => (
              <button
                key={activity.title}
                type="button"
                className={`dashboard-item-button ${activeIndex === index ? 'active' : ''}`}
                onClick={() => onSelectActivity(index)}
                title={activity.createdBy ? `Gemaakt door: ${activity.createdBy}` : 'Onbekende creator'}
              >
                <div>{activity.title}</div>
                <div className="dashboard-item-meta">
                  <span>{activity.category ?? 'Algemeen'}</span>
                  <span>{activity.status ?? 'gepland'}</span>
                  {typeof activity.maxParticipants === 'number' ? <span>Max {activity.maxParticipants}</span> : null}
                </div>
                {activity.createdBy && <small style={{ opacity: 0.7, fontSize: '0.85em' }}>door: {activity.createdBy}</small>}
              </button>
            ))
          ) : (
            <div className="dashboard-empty">Geen activiteiten</div>
          )}
        </div>

        <div className="dashboard-details">
          <div className="dashboard-details-title">Deelnemers lijst</div>
          {selected ? (
            <div className="dashboard-details-content">
              <div className="dashboard-detail-line">
                <span>Activiteit</span>
                <strong>{selected.title}</strong>
              </div>
              <div className="dashboard-detail-line">
                <span>Aantal deelnemers</span>
                <strong>{selected.participants}</strong>
              </div>
              {(() => {
                const { averageRating, totalRatings } = getActivityPollStats(selected.id)
                return averageRating !== null ? (
                  <div className="dashboard-detail-line">
                    <span>Gemiddelde rating</span>
                    <strong>{averageRating} / 5 ({totalRatings} ratings)</strong>
                  </div>
                ) : null
              })()}
              <div className="dashboard-participants-list">
                <div className="dashboard-participants-title">Geregistreerde deelnemers</div>
                {selected.participantsList.length > 0 ? (
                  <ul>
                    {selected.participantsList.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : selected.participants > 0 ? (
                  <p>Er zijn deelnemers, maar de namen zijn nog niet geregistreerd.</p>
                ) : (
                  <p>Er zijn nog geen deelnemers ingeschreven.</p>
                )}
              </div>
              <div className="dashboard-detail-note">
                Hier zie je de deelnemersinformatie per geselecteerde activiteit.
              </div>
            </div>
          ) : (
            <div className="dashboard-empty">Selecteer een activiteit om details te zien.</div>
          )}
        </div>
      </div>

      <div className="dashboard-footer">
        <div className="dashboard-stats">
          Totaal bevestigd aanwezig (zeker): {activiteiten.reduce((sum, item) => sum + item.participants, 0)}
        </div>
        <div className="dashboard-actions">
          <button
            type="button"
            className="dashboard-action-button"
            onClick={onEditActivity}
            disabled={!canEditSelectedActivity}
          >
            Bewerken
          </button>
          <button
            type="button"
            className="dashboard-action-button"
            onClick={onDeleteActivity}
            disabled={!canEditSelectedActivity}
          >
            Verwijderen
          </button>
          <button type="button" className="dashboard-action-button" onClick={onExportData}>
            Exporteer JSON
          </button>
          <button type="button" className="dashboard-action-button primary" onClick={onNewActivity}>
            Nieuwe Activiteit
          </button>
        </div>
      </div>
    </section>
  )
}

export default ActiviteitenDashboard

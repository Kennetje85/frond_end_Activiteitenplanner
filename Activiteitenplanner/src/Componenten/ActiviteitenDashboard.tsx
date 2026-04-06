import './ActiviteitenDashboard.css'

type DashboardActivity = {
  title: string
  participants: number
  participantsList: string[]
}

type ActiviteitenDashboardProps = {
  activiteiten: DashboardActivity[]
  activeIndex: number
  onSelectActivity: (index: number) => void
  onEditActivity: () => void
  onDeleteActivity: () => void
  onNewActivity: () => void
  onExportData: () => void
}

function ActiviteitenDashboard({
  activiteiten,
  activeIndex,
  onSelectActivity,
  onEditActivity,
  onDeleteActivity,
  onNewActivity,
  onExportData,
}: ActiviteitenDashboardProps) {
  const visibleActivities = activiteiten
  const selected = visibleActivities[activeIndex] || null

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
              >
                {activity.title}
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
          <button type="button" className="dashboard-action-button" onClick={onEditActivity}>
            Bewerken
          </button>
          <button type="button" className="dashboard-action-button" onClick={onDeleteActivity}>
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

import './ITBeheerDashboard.css'

type UserCredentials = {
  name: string
  email: string
  role?: string
}

type ActivityOverview = {
  title: string
  participants: number
  participantsList: string[]
}

type ITBeheerDashboardProps = {
  registeredUsers: UserCredentials[]
  activiteiten: ActivityOverview[]
  logs: string[]
  apiStatus: boolean | null
}

function ITBeheerDashboard({ registeredUsers, activiteiten, logs, apiStatus }: ITBeheerDashboardProps) {
  const activeUsers = registeredUsers.length
  const totalParticipants = activiteiten.reduce((sum, item) => sum + item.participants, 0)
  const monitoredUsers = registeredUsers.slice(0, 5)
  const knownLogs = logs.length > 0 ? logs : [
    '09:22 - Beheer heeft ingelogd',
    '09:28 - Systeemstatus gecontroleerd',
    '09:34 - Nieuwe gebruiker aangemaakt',
    '09:50 - Logs geanalyseerd',
  ]

  return (
    <section className="beheer-panel">
      <div className="beheer-topbar">
        <div className="beheer-title">IT Beheer Dashboard</div>
        <div className="beheer-actions">
          <button type="button">System Status</button>
          <button type="button">Gebruikersbeheer</button>
          <button type="button">Activiteitenlijst</button>
        </div>
      </div>

      <div className="beheer-body">
        <div className="beheer-widget beheer-status">
          <h3>System status</h3>
          <p>Alle systemen werken normaal.</p>
          <div className="beheer-status-grid">
            <div>Webserver: OK</div>
            <div>Database: OK</div>
            <div>API: {apiStatus === null ? 'Controleren...' : apiStatus ? 'OK' : 'Niet bereikbaar'}</div>
            <div>Authenticatie: OK</div>
          </div>
        </div>

        <div className="beheer-widget beheer-userlist">
          <h3>Gebruikerslijst</h3>
          {monitoredUsers.length > 0 ? (
            <ul>
              {monitoredUsers.map((user) => (
                <li key={user.email || user.name}>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Geen geregistreerde gebruikers gevonden.</p>
          )}
        </div>

        <div className="beheer-widget beheer-monitoring">
          <h3>Monitoring</h3>
          <div className="beheer-monitoring-box">
            <p>Controleer CPU, geheugen en netwerkverkeer.</p>
            <div>CPU: 46%</div>
            <div>Geheugen: 68%</div>
            <div>Netwerk: 112 Mbps</div>
          </div>
          <div className="beheer-activity-summary">
            <div>
              <strong>{activeUsers}</strong>
              <span>Beheerders</span>
            </div>
            <div>
              <strong>{knownLogs.length}</strong>
              <span>Recente logs</span>
            </div>
            <div>
              <strong>{totalParticipants}</strong>
              <span>Totaal deelnemers</span>
            </div>
          </div>
        </div>
      </div>

      <div className="beheer-log-panel">
        <div className="beheer-log-title">Logs</div>
        <ul>
          {knownLogs.map((log) => (
            <li key={log}>{log}</li>
          ))}
        </ul>
      </div>

      <div className="beheer-footer">
        <div className="beheer-warning">Waarschuwing: hou verdachte loginpogingen in de gaten.</div>
      </div>
    </section>
  )
}

export default ITBeheerDashboard

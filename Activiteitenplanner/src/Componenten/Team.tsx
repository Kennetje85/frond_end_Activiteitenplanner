import React, { useEffect, useState } from 'react'
import * as api from '../api/api'

type User = {
  id?: number
  name: string
  email: string
  role?: string
}

export default function Team({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api.getUsers().then((res) => {
      if (!mounted) return
      setUsers(res ?? [])
    }).catch(() => {
      // fallback: empty
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Team beheer</h2>
        <div>
          <button className="activiteiten-button" type="button" onClick={onBack}>Terug</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
              <th>Naam</th>
              <th>Email</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td style={{ padding: '10px 8px' }}>{u.name}</td>
                <td style={{ padding: '10px 8px' }}>{u.email}</td>
                <td style={{ padding: '10px 8px' }}>{u.role ?? 'member'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

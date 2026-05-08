export type UserCredentials = {
  name: string
  email: string
  password: string
  role?: 'admin'
}

export type ApiActivity = {
  id: number
  title: string
  description: string
  date: string
  time: string
  location: string
  participants: number
  participantsList: string[]
  registrations?: Array<{
    userEmail: string
    userName: string
    status: 'zeker' | 'misschien' | 'niet'
  }>
  image: string
  createdBy?: string
}

export type ApiLog = {
  id?: number
  message: string
  createdAt: string
}

export type ApiPoll = {
  id?: number
  activityId: number
  userEmail: string
  userName: string
  rating: number
  createdAt: string
  updatedAt: string
}

export type ApiRegistration = {
  id?: number
  activityId: number
  userEmail: string
  userName: string
  status: 'zeker' | 'misschien' | 'niet'
  registeredAt?: string
}

        const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })

  const hasJson = typeof (response as Response).json === 'function'
  const hasText = typeof (response as Response).text === 'function'

  const parseBody = async () => {
    if (hasJson) {
      try {
        // Some responses may have empty bodies which cause json() to throw.
        return await (response as Response).json()
      } catch {
        // fallthrough to try text parsing or return null
      }
    }

    if (hasText) {
      try {
        const text = await (response as Response).text()
        if (!text) return null
        try {
          return JSON.parse(text)
        } catch {
          return text
        }
      } catch {
        return null
      }
    }

    return null
  }

  if (!response.ok) {
    try {
      const parsed = await parseBody()
      const message = parsed && typeof parsed === 'object' && parsed.message ? String((parsed as any).message) : `API error ${response.status}`
      throw new Error(message)
    } catch (error) {
      if (error instanceof Error && error.message && error.message !== `API error ${response.status}`) {
        throw error
      }

      throw new Error(`API error ${response.status}`)
    }
  }

  try {
    const parsed = await parseBody()
    return (parsed ?? {}) as T
  } catch {
    // If response is not JSON, return empty object
    return {} as T
  }
}

export async function getUsers(): Promise<UserCredentials[]> {
  return fetchJson<UserCredentials[]>('/users')
}

export async function findUsersByEmail(email: string): Promise<UserCredentials[]> {
  return fetchJson<UserCredentials[]>(`/users?email=${encodeURIComponent(email)}`)
}

export async function createUser(user: UserCredentials): Promise<UserCredentials> {
  return fetchJson<UserCredentials>('/users', {
    method: 'POST',
    body: JSON.stringify(user),
  })
}

export async function getActivities(): Promise<ApiActivity[]> {
  return fetchJson<ApiActivity[]>('/activities')
}

export async function createActivity(activity: Omit<ApiActivity, 'id'>): Promise<ApiActivity> {
  return fetchJson<ApiActivity>('/activities', {
    method: 'POST',
    body: JSON.stringify(activity),
  })
}

export async function updateActivity(id: number, updates: Partial<ApiActivity>): Promise<ApiActivity> {
  return fetchJson<ApiActivity>(`/activities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteActivity(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/activities/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }
}

export async function getLogs(): Promise<ApiLog[]> {
  return fetchJson<ApiLog[]>('/logs?_sort=id&_order=desc')
}

export async function getPolls(): Promise<ApiPoll[]> {
  return fetchJson<ApiPoll[]>('/polls')
}

export async function findPollByActivityAndUser(activityId: number, userEmail: string): Promise<ApiPoll | null> {
  const polls = await fetchJson<ApiPoll[]>(`/polls?activityId=${activityId}&userEmail=${encodeURIComponent(userEmail)}`)
  return polls[0] ?? null
}

export async function createPoll(poll: Omit<ApiPoll, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiPoll> {
  const timestamp = new Date().toISOString()
  return fetchJson<ApiPoll>('/polls', {
    method: 'POST',
    body: JSON.stringify({
      ...poll,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  })
}

export async function getRegistrations(): Promise<ApiRegistration[]> {
  return fetchJson<ApiRegistration[]>('/registrations')
}

export async function findRegistrationByActivityAndUser(
  activityId: number,
  userEmail: string,
): Promise<ApiRegistration | null> {
  const registrations = await fetchJson<ApiRegistration[]>(
    `/registrations?activityId=${activityId}&userEmail=${encodeURIComponent(userEmail)}`,
  )
  return registrations[0] ?? null
}

export async function createRegistration(
  registration: Omit<ApiRegistration, 'id' | 'registeredAt'>,
): Promise<ApiRegistration> {
  return fetchJson<ApiRegistration>('/registrations', {
    method: 'POST',
    body: JSON.stringify({
      ...registration,
      registeredAt: new Date().toISOString(),
    }),
  })
}

export async function updateRegistration(
  id: number,
  updates: Partial<ApiRegistration>,
): Promise<ApiRegistration> {
  return fetchJson<ApiRegistration>(`/registrations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteRegistration(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/registrations/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }
}

export async function upsertRegistration(
  registration: Omit<ApiRegistration, 'id' | 'registeredAt'>,
): Promise<ApiRegistration> {
  const existing = await findRegistrationByActivityAndUser(registration.activityId, registration.userEmail)

  if (existing?.id !== undefined) {
    return updateRegistration(existing.id, {
      userName: registration.userName,
      status: registration.status,
    })
  }

  return createRegistration(registration)
}

export async function updatePoll(
  id: number,
  rating: number,
): Promise<ApiPoll> {
  return fetchJson<ApiPoll>(`/polls/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      rating,
      updatedAt: new Date().toISOString(),
    }),
  })
}

export async function upsertPoll(params: {
  activityId: number
  userEmail: string
  userName: string
  rating: number
}): Promise<ApiPoll> {
  const existing = await findPollByActivityAndUser(params.activityId, params.userEmail)

  if (existing?.id !== undefined) {
    return updatePoll(existing.id, params.rating)
  }

  return createPoll(params)
}

export async function appendLog(message: string): Promise<ApiLog> {
  return fetchJson<ApiLog>('/logs', {
    method: 'POST',
    body: JSON.stringify({
      message,
      createdAt: new Date().toISOString(),
    }),
  })
}

export async function loginUser(email: string, password: string): Promise<UserCredentials> {
  // Try the more RESTful /users/login first (some backends use this),
  // fall back to /login when a 404 is returned so differing API_URL values work.
  try {
    return await fetchJson<UserCredentials>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  } catch (err) {
    const msg = String((err as any)?.message ?? '')
    if (msg.includes('404')) {
      return fetchJson<UserCredentials>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
    }
    throw err
  }
}

export async function changePassword(
  userId: number,
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  console.log('[api.changePassword] Calling with userId:', userId)
  return fetchJson<{ message: string }>(`/users/${userId}/change-password`, {
    method: 'PUT',
    body: JSON.stringify({ email, oldPassword, newPassword }),
  })
}

export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(API_URL, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

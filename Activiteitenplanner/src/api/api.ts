export type UserCredentials = {
  name: string
  email: string
  password: string
  role?: 'admin' | 'beheer'
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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}`)
  }

  return response.json() as Promise<T>
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

export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(API_URL, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

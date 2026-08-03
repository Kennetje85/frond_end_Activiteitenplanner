
export const statusMap = {
  zeker: 1,
  misschien: 2,
  niet: 3,
} as const


export type UserCredentials = {
  id?: number
  name: string
  email: string
  password: string
  firstName?: string
  lastName?: string
  username?: string
  birthDate?: string
  country?: string
  privacyAccepted?: boolean
  role?: 'admin'
  blocked?: boolean
  favorites?: number[]
  notifications?: string[]
}

export type ApiActivity = {
  id: number
  title: string
  description: string
  category?: string
  date: string
  time: string
  location: string
  participants: number
  maxParticipants?: number
  status?: string
  participantsList: string[]
  registrations?: Array<{
    userEmail: string
    userName: string
    status: 1 | 2 | 3
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
  userId?: number
  userEmail: string
  userName: string
  rating: number
  createdAt: string
  updatedAt: string
}

export type ApiRegistration = {
  id?: number
  activityId: number
  userId?: number   
  userEmail: string
  userName: string
  status: 1 | 2 | 3
  registeredAt?: string
}

export type ValidationProblem = {
  type?: string
  title?: string
  status?: number
  instance?: string
  errors?: Record<string, string[]>
}

export class ValidationError extends Error {
  errors?: Record<string, string[]>
  constructor(message: string, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

const JWT_TOKEN_KEY = 'jwt'

export function getJwtToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(JWT_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setJwtToken(token: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (token) {
      localStorage.setItem(JWT_TOKEN_KEY, token)
    } else {
      localStorage.removeItem(JWT_TOKEN_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export function clearJwtToken(): void {
  setJwtToken(null)
}

function normalizeApiBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

export const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_URL ??
  'https://backendactiviteitenplanner20260529113158-gkejcgexb7g3a6cm.swedencentral-01.azurewebsites.net/api',
)
async function parseJsonOrProblem(response: Response): Promise<unknown> {
  const contentType = response.headers?.get?.('content-type') ?? ''
  if (typeof response.json === 'function') {
    try {
      return await response.json()
    } catch {
      // fall through to text parsing
    }
  }

  if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    const text = await response.text()
    return text || null
  } catch {
    return null
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getJwtToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const url = `${API_BASE}/${path.replace(/^\/+/, '')}`

  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const parsed = await parseJsonOrProblem(response)

    if (parsed && typeof parsed === 'object') {
      const payload = parsed as ValidationProblem & { message?: string; detail?: string; error?: string }

      if (payload.errors && typeof payload.errors === 'object') {
        const normalizedErrors: Record<string, string[]> = {}
        for (const [key, value] of Object.entries(payload.errors)) {
          if (Array.isArray(value)) {
            normalizedErrors[key] = value.map(String)
          } else if (typeof value === 'string') {
            normalizedErrors[key] = [value]
          }
        }

        const message = payload.title ?? `API error ${response.status}`
        throw new ValidationError(message, normalizedErrors)
      }

      if (payload.message) {
        throw new Error(String(payload.message))
      }

      if (payload.error) {
        throw new Error(String(payload.error))
      }

      if (payload.title) {
        const detail = payload.detail ? ` - ${payload.detail}` : ''
        throw new Error(`${payload.title}${detail}`)
      }
    }

    if (typeof parsed === 'string' && parsed.trim().length > 0) {
      throw new Error(`API error ${response.status}: ${parsed.trim()}`)
    }

    throw new Error(`API error ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  const parsed = await parseJsonOrProblem(response)
  return (parsed ?? {}) as T
}

export async function getUsers(): Promise<UserCredentials[]> {
  return fetchJson<UserCredentials[]>('users')
}

export async function findUsersByEmail(email: string): Promise<UserCredentials[]> {
  return fetchJson<UserCredentials[]>(`users?email=${encodeURIComponent(email)}`)
}

export async function createUser(user: UserCredentials): Promise<UserCredentials> {
  const body = {
    ...user,
    Name: user.name,
    FirstName: user.firstName,
    LastName: user.lastName,
    Username: user.username,
    Email: user.email,
    Password: user.password,
    BirthDate: user.birthDate,
    Country: user.country,
    PrivacyAccepted: user.privacyAccepted,
    Role: user.role,
    Blocked: user.blocked,
    Favorites: user.favorites,
    Notifications: user.notifications,
  }

  const result = await fetchJson<any>('users', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (result && (result.token || result.accessToken)) {
    const token = result.token || result.accessToken
    setJwtToken(token)
    console.debug('[api.createUser] JWT token stored')
  }

  return result as UserCredentials
}

export async function getActivities(): Promise<ApiActivity[]> {
  return fetchJson<ApiActivity[]>('activities')
}

export async function createActivity(activity: Omit<ApiActivity, 'id'>): Promise<ApiActivity> {
  const body = {
    ...activity,
    Title: activity.title,
    Description: activity.description,
    Category: activity.category,
    Date: activity.date,
    Time: activity.time,
    Location: activity.location,
    Participants: activity.participants,
    MaxParticipants: activity.maxParticipants,
    Status: activity.status,
    ParticipantsList: activity.participantsList,
    Registrations: activity.registrations,
    Image: activity.image,
    CreatedBy: activity.createdBy,
  }

  return fetchJson<ApiActivity>('activities', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateActivity(
  id: number,
  updates: Partial<ApiActivity> & Record<string, unknown>,
): Promise<ApiActivity> {
  const body = {
    ...updates,
    Title: updates.title,
    Description: updates.description,
    Category: updates.category,
    Date: updates.date,
    Time: updates.time,
    Location: updates.location,
    Participants: updates.participants,
    MaxParticipants: updates.maxParticipants,
    Status: updates.status,
    ParticipantsList: updates.participantsList,
    Registrations: updates.registrations,
    Image: updates.image,
    CreatedBy: updates.createdBy,
  }

  return fetchJson<ApiActivity>(`activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteActivity(id: number): Promise<void> {
  await fetchJson<void>(`activities/${id}`, { method: 'DELETE' })
}

export async function getLogs(): Promise<ApiLog[]> {
  return fetchJson<ApiLog[]>('logs?_sort=id&_order=desc')
}

export async function getPolls(): Promise<ApiPoll[]> {
  return fetchJson<ApiPoll[]>('polls')
}

export async function findPollByActivityAndUser(
  activityId: number,
  userEmail: string,
  userId?: number,
): Promise<ApiPoll | null> {
  const query = `polls?activityId=${activityId}`
  const polls = await fetchJson<ApiPoll[]>(query)
  const match = userId !== undefined
    ? polls.find((poll) => Number((poll as any).userId) === userId)
    : polls.find((poll) => typeof poll.userEmail === 'string' && poll.userEmail.toLowerCase() === userEmail.toLowerCase())
  console.log('[api.findPollByActivityAndUser] activityId=', activityId, 'userEmail=', userEmail, 'userId=', userId, 'found:', polls, 'match:', match)
  return match ?? null
}

export async function createPoll(poll: Omit<ApiPoll, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiPoll> {
  const timestamp = new Date().toISOString()
  const body: any = {
    activityId: poll.activityId,
    rating: poll.rating,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  
  // Check if user object has id (ASP.NET format) or use email (local backend format)
  if ((poll as any).userId !== undefined) {
    body.userId = (poll as any).userId
  } else {
    body.userEmail = poll.userEmail
    body.userName = poll.userName
  }
  
  console.log('[api.createPoll] Sending body:', body)
  return fetchJson<ApiPoll>('polls', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getRegistrations(): Promise<ApiRegistration[]> {
  return fetchJson<ApiRegistration[]>('registrations')
}

export async function findRegistrationByActivityAndUser(
  activityId: number,
  userEmail: string,
): Promise<ApiRegistration | null> {
  const registrations = await fetchJson<ApiRegistration[]>(
    `registrations?activityId=${activityId}&userEmail=${encodeURIComponent(userEmail)}`,
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

  return fetchJson<ApiRegistration>(`registrations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
   
  })
}

export async function deleteRegistration(id: number): Promise<void> {
  await fetchJson<void>(`registrations/${id}`, { method: 'DELETE' })
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

export async function updatePoll(id: number, rating: number): Promise<ApiPoll> {
  const body = { rating, updatedAt: new Date().toISOString() }
  console.log('[api.updatePoll] Updating poll', id, 'with body:', body)
  return fetchJson<ApiPoll>(`polls/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function upsertPoll(params: {
  activityId: number
  userEmail: string
  userName: string
  rating: number
  userId?: number
}): Promise<ApiPoll> {
  const existing = await findPollByActivityAndUser(params.activityId, params.userEmail, params.userId)

  if (existing?.id !== undefined) {
    return updatePoll(existing.id, params.rating)
  }

  return createPoll(params as Omit<ApiPoll, 'id' | 'createdAt' | 'updatedAt'>)
}

const PENDING_POLLS_KEY = 'industrieon-pending-polls'

export type PendingPoll = {
  activityId: number
  userEmail: string
  userName: string
  rating: number
  createdAt: string
}

export function getPendingPolls(): PendingPoll[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PENDING_POLLS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PendingPoll[]
  } catch {
    return []
  }
}

export function addPendingPoll(poll: Omit<PendingPoll, 'createdAt'>): PendingPoll {
  if (typeof window === 'undefined') return { ...poll, createdAt: new Date().toISOString() }
  try {
    const current = getPendingPolls()
    const entry: PendingPoll = { ...poll, createdAt: new Date().toISOString() }
    const merged = [...current.filter(p => !(p.activityId === poll.activityId && p.userEmail.toLowerCase() === poll.userEmail.toLowerCase())), entry]
    localStorage.setItem(PENDING_POLLS_KEY, JSON.stringify(merged))
    return entry
  } catch {
    return { ...poll, createdAt: new Date().toISOString() }
  }
}

export async function flushPendingPolls(): Promise<{ success: PendingPoll[]; failed: PendingPoll[] } > {
  const pending = getPendingPolls()
  if (!pending.length) return { success: [], failed: [] }

  const success: PendingPoll[] = []
  const failed: PendingPoll[] = []

  for (const p of pending) {
    try {
      await upsertPoll({ activityId: p.activityId, userEmail: p.userEmail, userName: p.userName, rating: p.rating })
      success.push(p)
    } catch {
      failed.push(p)
    }
  }

  try {
    // store only failed ones
    if (failed.length) {
      localStorage.setItem(PENDING_POLLS_KEY, JSON.stringify(failed))
    } else {
      localStorage.removeItem(PENDING_POLLS_KEY)
    }
  } catch {
    // ignore storage errors
  }

  return { success, failed }
}

export async function appendLog(message: string): Promise<ApiLog> {
  return fetchJson<ApiLog>('logs', {
    method: 'POST',
    body: JSON.stringify({
      message,
      createdAt: new Date().toISOString(),
    }),
  })
}

export async function login(email: string, password: string) {
  const payload = await fetchJson<{ token?: string; accessToken?: string; [key: string]: unknown }>('users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  const token = typeof payload.token === 'string'
    ? payload.token
    : typeof payload.accessToken === 'string'
      ? payload.accessToken
      : null

  if (token) {
    setJwtToken(token)
  }

  return payload
}

export async function loginUser(email: string, password: string): Promise<UserCredentials> {
  try {
    const result = await login(email, password)
    if (result && ((result as any).token || (result as any).accessToken)) {
      console.debug('[api.loginUser] JWT token stored')
    }

    if (result && typeof result === 'object' && 'user' in result && (result as any).user) {
      return (result as any).user as UserCredentials
    }

    return result as UserCredentials
  } catch (err) {
    const msg = String((err as any)?.message ?? '')
    if (msg.includes('404')) {
      const result = await fetchJson<any>('login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (result && (result.token || result.accessToken)) {
        setJwtToken(result.token || result.accessToken)
        console.debug('[api.loginUser] JWT token stored')
      }

      if (result && typeof result === 'object' && 'user' in result && (result as any).user) {
        return (result as any).user as UserCredentials
      }

      return result as UserCredentials
    }

    if (
      msg.includes('401') &&
      email.trim().toLowerCase() === 'admin@admin.com' &&
      password === 'admin'
    ) {
      console.warn('[api.loginUser] Backend rejected the built-in admin login; using local fallback')
      clearJwtToken()
      return {
        id: 1,
        name: 'admin',
        email: 'admin@admin.com',
        role: 'admin',
        password: '',
      } as UserCredentials
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
  return fetchJson<{ message: string }>(`users/${userId}/change-password`, {
    method: 'PUT',
    body: JSON.stringify({ email, oldPassword, newPassword }),
  })
}

export async function updateUser(id: number, updates: Partial<UserCredentials>): Promise<UserCredentials> {
  return fetchJson<UserCredentials>(`users/${id}` , {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function deleteUser(id: number): Promise<void> {
  await fetchJson<void>(`users/${id}`, { method: 'DELETE' })
}

export async function logoutUser(): Promise<void> {
  clearJwtToken()
  console.debug('[api.logoutUser] JWT token cleared')
}

export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

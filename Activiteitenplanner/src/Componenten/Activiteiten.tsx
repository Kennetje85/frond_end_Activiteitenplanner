import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import activiteitenData from '../data/activiteiten.json'
import * as api from '../api/api'
import Login from './Login'
import ActiviteitenDetails from './ActiviteitenDetails'
import ActiviteitenDashboard from './ActiviteitenDashboard'
import './Activiteiten.css'

function getAuthHeaders(): Record<string, string> {
  const token = api.getJwtToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}


// Overzicht van deze component (kort):
// - Beheert de lijst met activiteiten, gebruikersinteracties en lokale cache.
// - Laadt activiteiten + logs vanaf de backend (indien beschikbaar), anders gebruikt hij lokale data.
// - Bevat helpers om data te normaliseren (ids, registraties, ratings).
// - Verwerkt inschrijven / uitschrijven, stemmen (polls) en synchronisatie (offline opslag).
// De belangrijkste functies die je wilt bestuderen voor je assessment:
// - normalizeActivity / normalizeStatus / normalizeRating: zetten inputdata om naar consistent types.
// - refreshPolls: haalt polls op van de API en normaliseert ze.
// - handleRate: verwerkt stemmen (PATCH of POST naar backend), met offline fallback.
// - useEffect hooks: laden backend data en synchroniseren pending polls bij opstart/gebruiker wissel.

//Er is een nieuw object met de volgende eigenschappen gemaakt: title, description, date, time, location, participants en image. Deze eigenschappen worden gebruikt om de details van een activiteit weer te geven en bij te houden hoeveel deelnemers er zijn.
export type Activiteit = {
  id?: number
  title: string
  description: string
  category: string
  date: string
  time: string
  location: string
  participants: number
  maxParticipants?: number
  status: string
  participantsList: string[]
  registrations: ActivityRegistration[]
  image: string
  createdBy?: string
}

type ParticipationStatus = 'zeker' | 'misschien' | 'niet'

type ActivityRegistration = {
  userEmail: string
  userName: string
  status: ParticipationStatus
}

type Poll = {
  id?: number
  activityId: number
  userEmail: string
  userName: string
  rating: number
  createdAt: string
  updatedAt: string
}

function normalizeStatus(value: unknown): ParticipationStatus {
  // Zet verschillende vormen van status (zoals oude numerieke waarden)
  // om naar de huidige string-waarden: 'zeker' | 'misschien' | 'niet'.
  // Dit zorgt dat oudere of onvolledige data consistent wordt gebruikt.
  if (value === 'zeker' || value === 'misschien' || value === 'niet') {
    return value
  }

  //isFinite omzetten naar een getal en controleren of het een geldig getal is. Dit behandelt legacy-waarden zoals 1, 2, 3 die mogelijk in oudere data zijn opgeslagen.
  const legacy = Number(value)
  if (Number.isFinite(legacy)) {
    if (legacy >= 4) {
      return 'zeker'
    }
    if (legacy === 3) {
      return 'misschien'
    }
  }

  return 'niet'
}

function normalizeRating(value: unknown): number {
  // Normalizeert een rating-waarde zodat het altijd een integer 1..5 wordt.
  // Ondersteunt ook legacy-waarden zoals status-strings ('zeker' -> 5).
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(5, Math.max(1, Math.round(value)))
  }

  if (value === 'zeker') {
    return 5
  }
  if (value === 'misschien') {
    return 3
  }

  return 1
}

function toApiRegistrationStatus(status: ParticipationStatus): 1 | 2 | 3 {
  if (status === 'zeker') {
    return 1
  }
  if (status === 'misschien') {
    return 2
  }
  return 3
}

function toApiRegistrations(registrations: ActivityRegistration[]): Array<{ userEmail: string; userName: string; status: 1 | 2 | 3 }> {
  return registrations.map((registration) => ({
    userEmail: registration.userEmail,
    userName: registration.userName,
    status: toApiRegistrationStatus(registration.status),
  }))
}

//Inloggen met naam, e-mail en wachtwoord. Deze gegevens worden gebruikt om gebruikers te identificeren en te bepalen of ze adminrechten hebben.
type UserCredentials = {
  name: string
  email: string
  password: string
  role?: 'admin' | 'bedrijf'
  firstName?: string
  lastName?: string
  username?: string
  birthDate?: string
  country?: string
  privacyAccepted?: boolean
  blocked?: boolean
}
// user verwacht een object met name, email, password en optioneel een role (zoals 'admin'). Deze informatie wordt gebruikt om gebruikers te authenticeren en autoriseren binnen de app.
//De Activiteiten component is het hoofdonderdeel van de applicatie. Het beheert de staat van activiteiten, gebruikers en de interacties tussen deze elementen. Het maakt gebruik van verschillende subcomponenten zoals Login, ActiviteitenDetails en ActiviteitenDashboard om specifieke functionaliteiten te bieden.
type ActiviteitenProps = {
  user: UserCredentials | null
  onLogin: (user: UserCredentials, mode: 'login' | 'register') => Promise<string | undefined>  // veracht een een functie die een foutmelding retourneert als string, of undefined bij succes
  onLogout: () => void
  onShowChangePassword?: () => void //optioneel hoeft niet aanwezig te zijn
}

//localstorage keys
const STORAGE_KEY = 'industrieon-activiteiten'
const STORAGE_LOGS_KEY = 'industrieon-beheer-logs'
const STORAGE_ACTIVITY_OWNERS_KEY = 'industrieon-activity-owners'


type LoginAction = 'add' | 'join' | null   //Gebruiker wil een activiteit toevoegen ('add'), deelnemen aan een activiteit ('join'), of er is geen actieve login-actie (null). Deze status wordt gebruikt om te bepalen welk formulier of welke actie getoond moet worden na het inloggen.

type ActivityOwnerMap = Record<string, string> //Het betekent sleutelwaarderden waarbij de sleutel een unieke identifier is voor een activiteit (zoals 'id:123' of 'title:voetbal') en de waarde het e-mailadres van de gebruiker die deze activiteit heeft gemaakt. Deze map wordt gebruikt om te bepalen wie de eigenaar is van een activiteit, vooral voor activiteiten die geen expliciete 'createdBy' veld hebben. Hierdoor kunnen we bewerken/verwijderen knoppen tonen aan de juiste gebruikers.



// Haalt de owner-cache uit localStorage en parseert deze.
// Retourneert een map met sleutels (zoals 'id:123' of 'title:naam') naar eigenaar-email.
// Wordt gebruikt om `createdBy` te vullen voor activiteiten zonder expliciete eigenaar.
function loadActivityOwners(): ActivityOwnerMap {
  if (typeof window === 'undefined') {  // draait niet in een webbrowser -> lege map
    return {}
  }

  const saved = localStorage.getItem(STORAGE_ACTIVITY_OWNERS_KEY)
  if (!saved) {
    return {}
  }

  try {
    const parsed = JSON.parse(saved)
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce<ActivityOwnerMap>((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value
        }
        return acc
      }, {})
    }
  } catch {
    // ignore invalid owner cache
  }

  return {}
}

// Maakt index-keys voor een activiteit om te gebruiken in de owner-cache.
// Voorbeeld: ['id:12', 'title:vergadering sen 1'] zodat we activiteiten betrouwbaar kunnen matchen.
function makeOwnerKeys(activity: Pick<Activiteit, 'id' | 'title'>): string[] {
  const keys: string[] = []
  if (activity.id !== undefined) {
    keys.push(`id:${activity.id}`)
  }

  const normalizedTitle = activity.title.trim().toLowerCase()
  if (normalizedTitle) {
    keys.push(`title:${normalizedTitle}`)
  }

  return keys
}

// Normalizeert een ruwe activiteit-object (backend of localStorage) naar `Activiteit`:
// - converteert velden (id → number)
// - zet registraties in het juiste formaat
// - berekent participants/participantsList
// Wordt overal gebruikt voordat data in state of localStorage wordt gezet.
function normalizeActivity(item: any): Activiteit {
  // zet id om naar een nummer of undefined
  const rawId = Number(item.id) //zet het om naar een getal
  const id = Number.isFinite(rawId) ? rawId : undefined
  const rawTitle = item.title ?? item.Title
  const rawDescription = item.description ?? item.Description
  const rawCategory = item.category ?? item.Category
  const rawDate = item.date ?? item.Date
  const rawTime = item.time ?? item.Time
  const rawLocation = item.location ?? item.Location
  const rawMaxParticipants = item.maxParticipants ?? item.MaxParticipants
  const rawStatus = item.status ?? item.Status
  const rawImage = item.image ?? item.Image
  const rawCreatedBy = item.createdBy ?? item.CreatedBy
  const parsedRegistrations = Array.isArray(item.registrations)
    ? item.registrations
        .filter((entry: any) => entry && typeof entry.userEmail === 'string' && typeof entry.userName === 'string')
        .map((entry: any) => ({
          userEmail: String(entry.userEmail),
          userName: String(entry.userName),
          status: normalizeStatus(entry.status),
        }))
    : []

  const fallbackParticipantsList = Array.isArray(item.participantsList)
    ? item.participantsList.map(String)
    : []

  const registrations = parsedRegistrations.length > 0
    ? parsedRegistrations
    : fallbackParticipantsList.map((name: string): ActivityRegistration => ({
        userEmail: `${name.toLowerCase().replace(/\s+/g, '.')}@placeholder.local`,
        userName: name,
        status: 'zeker' as const,
      }))

  const participantsList = registrations
    .filter((entry: ActivityRegistration) => entry.status === 'zeker')
    .map((entry: ActivityRegistration) => entry.userName)



  const participants = participantsList.length

  return {
    id,
    title: String(rawTitle ?? 'Onbekende activiteit'),
    description: String(rawDescription ?? ''),
    category: String(rawCategory ?? 'Algemeen'),
    date: String(rawDate ?? 'Datum nog in te vullen'),
    time: String(rawTime ?? 'Tijd nog in te vullen'),
    location: String(rawLocation ?? ''),
    participants,
    maxParticipants: Number.isFinite(Number(rawMaxParticipants)) ? Number(rawMaxParticipants) : undefined,
    status: String(rawStatus ?? 'gepland'),
    participantsList,
    registrations,
    image: String(rawImage ?? ''),
    createdBy: rawCreatedBy ? String(rawCreatedBy) : undefined,
  }
}

// Laadt activiteiten bij component-initialisatie:
// - eerst proberen we localStorage; als dat er niet is, gebruiken we de static JSON fallback.
// - normaliseert items met `normalizeActivity`.
function loadActivities(): Activiteit[] {
  if (typeof window === 'undefined') {
    return activiteitenData.map(normalizeActivity)
  }

  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    return activiteitenData.map(normalizeActivity)
  }

  try {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeActivity)
    }
  } catch {
    // fallback to default JSON data
  }

  return activiteitenData.map(normalizeActivity)
}

// Laadt admin/log entries; momenteel een placeholder die een lege lijst retourneert
// (kan uitgebreid worden om backend-logs te tonen).
function loadLogs(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  return []
}

function Activiteiten({ user, onLogin, onLogout, onShowChangePassword }: ActiviteitenProps) {
  // --- Component state ---
  // De state-variabelen hieronder houden alle UI- en business-waarden bij:
  // - activiteiten: lijst met activiteiten
  // - form fields: title, description, date, time, location, image
  // - UI flags: showForm, showLogin, editingIndex, selectedIndex
  // - polls, logs en owner-cache
  const [activiteiten, setActiviteiten] = useState<Activiteit[]>(() => loadActivities())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('Algemeen')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [status, setStatus] = useState('gepland')
  const [image, setImage] = useState('')
  const [imageFileKey, setImageFileKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [loginAction, setLoginAction] = useState<LoginAction>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loginError, setLoginError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [logs, setLogs] = useState<string[]>(() => loadLogs())
  const [dashboardSelected, setDashboardSelected] = useState(0)
  const [formError, setFormError] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedStatusChoice, setSelectedStatusChoice] = useState<ParticipationStatus>('zeker')
  const [showMyActivitiesOnly, setShowMyActivitiesOnly] = useState(false)
  const [activityOwners, setActivityOwners] = useState<ActivityOwnerMap>(() => loadActivityOwners())
  const [favoriteActivityIds, setFavoriteActivityIds] = useState<number[]>([])
  const [debugAttempts, setDebugAttempts] = useState<Array<{ url: string; ok: boolean; status?: number; body?: string; error?: string }>>([])
  const [searchQuery, setSearchQuery] = useState('')

  const editorRef = useRef<HTMLDivElement | null>(null)

  // Very small sanitizer: remove script tags to avoid obvious XSS in this prototype.
  const sanitize = (html: string | undefined | null) => {
    if (!html) return ''
    return String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  }

  const applyFormat = (command: string, value?: string) => {
    try {
      document.execCommand(command, false, value)
      // update description state from editor content
      setDescription(editorRef.current?.innerHTML ?? '')
    } catch {
      // execCommand may be unavailable in some environments; ignore silently
    }
  }

  useEffect(() => {
    // Keep editor DOM in sync when description state changes (e.g., when editing an existing activity)
    if (editorRef.current) {
      const sanitized = sanitize(description)
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized
      }
    }
  }, [description, showForm])

  const resolveActivityOwner = (activity: Activiteit): Activiteit => {
    if (activity.createdBy) {
      return activity
    }

    const owner = makeOwnerKeys(activity)
      .map((key) => activityOwners[key])
      .find((value) => typeof value === 'string' && value.length > 0)

    return owner ? { ...activity, createdBy: owner } : activity
  }
  // Vult `createdBy` voor een activiteit aan op basis van de owner-cache.
  // Als een activiteit geen expliciete eigenaar heeft, proberen we via
  // `activityOwners` (id/title keys) een match te vinden.
  const rememberActivityOwner = (activity: Activiteit, ownerEmail?: string) => {
    const email = ownerEmail?.trim().toLowerCase()
    if (!email) {
      return
    }

    const keys = makeOwnerKeys(activity)
    if (keys.length === 0) {
      return
    }

    setActivityOwners((current) => {
      const next = { ...current }
      for (const key of keys) {
        next[key] = email
      }
      return next
    })
  }

  // Slaat een administratie-log op (zowel lokaal in state als naar backend wanneer mogelijk).
  // Wordt gebruikt voor auditable gebeurtenissen (login, create, update, delete, votes sync).
  const addLog = async (message: string) => {
    setLogs((current) => [message, ...current].slice(0, 100))

    try {
      await api.appendLog(message)
    } catch (err) {
      // fallback to local storage if backend is unavailable or endpoint doesn't exist
      console.debug('[addLog] Backend log failed, using local only:', err)
    }
  }

  // Persistente opslag: houd belangrijke stukken state in localStorage zodat de app
  // offline bruikbaar blijft en voorkeuren/gegevens niet verloren gaan.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activiteiten))
  }, [activiteiten])

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVITY_OWNERS_KEY, JSON.stringify(activityOwners))
  }, [activityOwners])

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.email) {
      setFavoriteActivityIds([])
      return
    }

    const storageKey = `industrieon-favorites-${user.email.toLowerCase()}`
    try {
      const saved = localStorage.getItem(storageKey)
      setFavoriteActivityIds(saved ? JSON.parse(saved) : [])
    } catch {
      setFavoriteActivityIds([])
    }
  }, [user?.email])

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.email) {
      return
    }

    const storageKey = `industrieon-favorites-${user.email.toLowerCase()}`
    localStorage.setItem(storageKey, JSON.stringify(favoriteActivityIds))
  }, [favoriteActivityIds, user?.email])

  // Ensure activities loaded from localStorage get their owner resolved
  useEffect(() => {
    setActiviteiten((current) => current.map(resolveActivityOwner))
    // Run whenever the owner map or initial activities change
  }, [activityOwners])

  useEffect(() => {
    async function loadBackendActivities() {
      try {
        const backendActivities = await api.getActivities()
        setActiviteiten(backendActivities.map(normalizeActivity).map(resolveActivityOwner))
        setDebugAttempts((d) => [...d, { url: 'api.getActivities()', ok: true }])
        return
      } catch (err) {
        console.warn('[Activiteiten] api.getActivities failed', err)
        setDebugAttempts((d) => [...d, { url: 'api.getActivities()', ok: false, error: String(err) }])
      }

      // Try direct fallback endpoints in case env or proxy prevents api client from reaching them
      const tried: { url: string; ok: boolean }[] = []
      const endpoints = [`${api.API_BASE}/activities`]

      for (const url of endpoints) {
        try {
          const resp = await fetch(url, { headers: getAuthHeaders() })
          const bodyText = await resp.text().catch(() => '')
          if (resp.ok) {
            const parsed = JSON.parse(bodyText || '[]')
            setActiviteiten(parsed.map(normalizeActivity).map(resolveActivityOwner))
            setDebugAttempts((d) => [...d, { url, ok: true, status: resp.status, body: String((parsed && Array.isArray(parsed)) ? `${parsed.length} items` : bodyText) }])
            return
          }
          setDebugAttempts((d) => [...d, { url, ok: false, status: resp.status, body: bodyText }])
          tried.push({ url, ok: false })
        } catch (e) {
          setDebugAttempts((d) => [...d, { url, ok: false, error: String(e) }])
          tried.push({ url, ok: false })
        }
      }

      console.error('[Activiteiten] All activity endpoints failed:', tried)
      setStatusMessage('Kon backend-activiteiten niet ophalen. Controleer of de backend draait. Zie debugdetails hieronder.')
    }

    async function loadBackendLogs() {
      try {
        const backendLogs = await api.getLogs()
        setLogs(backendLogs.map((log) => `${new Date(log.createdAt).toLocaleString()} - ${log.message}`))
      } catch {
        // fallback to local browser logs
      }
    }

    // Laad backend-data (indien bereikbaar). Als backend niet beschikbaar is,
    // werkt de app offline met lokale data in localStorage.
    loadBackendActivities()
    loadBackendLogs()
    // Haal polls op en normaliseer ze zodat de UI stemmen kan tonen
    void refreshPolls()
  }, [])

  async function refreshPolls() {
    try {
      const backendPolls = await api.getPolls()
      console.log('[refreshPolls] Raw backend polls:', backendPolls)
      console.log('[refreshPolls] Current user:', user)
      
      const mapped = backendPolls.map((poll) => {
        // Handle ASP.NET backend format (has userId instead of userEmail)
        let userEmail = String((poll as any).userEmail ?? '').trim()
        if (!userEmail && (poll as any).userId && user) {
          // If no userEmail but userId matches current user, use current user's email
          // This handles ASP.NET backend that sends userId instead of userEmail
          const userId = Number((poll as any).userId)
          const currentUserId = (user as any).id
          console.log(`[refreshPolls] Poll userId=${userId}, user.id=${currentUserId}`)
          if (userId === currentUserId) {
            userEmail = user.email
            console.log(`[refreshPolls] Matched! Set userEmail to ${userEmail}`)
          }
        }
        
        return {
          ...poll,
          activityId: Number((poll as any).activityId),
          userEmail,
          rating: normalizeRating((poll as Poll & { participation?: ParticipationStatus }).rating ?? (poll as Poll & { participation?: ParticipationStatus }).participation),
        } as Poll
      })
      
      console.log('[refreshPolls] Final mapped polls:', mapped)
      setPolls(mapped)
    } catch (err) {
      console.error('[refreshPolls] Error:', err)
    }
  }

  useEffect(() => {
    if (!user || loginAction !== 'add') {
      return
    }

    setEditingIndex(null)
    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setLocation('')
    setImage('')
    setFormError('')
    setShowForm(true)
    setLoginAction(null)
    setFieldErrors({})
  }, [user, loginAction])

  const selectedActivity = selectedIndex !== null ? activiteiten[selectedIndex] : null
  const selectedActivityId = selectedActivity?.id !== undefined ? Number(selectedActivity.id) : null
  const selectedUserRegistration = selectedActivity && user
    ? selectedActivity.registrations.find((entry) => entry.userEmail === user.email) ?? null
    : null
  const isRegistered = selectedUserRegistration !== null
  const selectedStatusCounts = selectedActivity
    ? selectedActivity.registrations.reduce(
        (counts, entry) => ({
          ...counts,
          [entry.status]: counts[entry.status] + 1,
        }),
        { zeker: 0, misschien: 0, niet: 0 },
      )
    : { zeker: 0, misschien: 0, niet: 0 }
  const selectedActivityPolls = selectedActivityId !== null
    ? polls.filter((poll) => Number(poll.activityId) === selectedActivityId)
    : []
  const userRating = selectedActivityId !== null && user
    ? polls.find((poll) => {
        const pollActivityId = Number(poll.activityId)
        const pollUserId = Number((poll as any).userId)
        const currentUserId = Number((user as any).id)
        const emailMatches = typeof poll.userEmail === 'string' && typeof user.email === 'string' && poll.userEmail.toLowerCase() === user.email.toLowerCase()
        return pollActivityId === selectedActivityId && (emailMatches || (Number.isFinite(pollUserId) && pollUserId === currentUserId))
      })?.rating ?? null
    : null
  const averageRating = selectedActivityPolls.length > 0
    ? Number((selectedActivityPolls.reduce((sum, poll) => sum + poll.rating, 0) / selectedActivityPolls.length).toFixed(1))
    : null
  const isAdmin =
    user?.role === 'admin' ||
    String(user?.name ?? '').toLowerCase() === 'admin' ||
    String(user?.email ?? '').toLowerCase() === 'admin@admin.com'
  const isBusinessAccount = user?.role === 'bedrijf'
  const roleLabel = isAdmin ? 'Admin' : isBusinessAccount ? 'Bedrijf' : user ? 'User' : 'Gast'

  // Helper function to check if user is the creator of an activity
  const isCreatorOfActivity = (activity: Activiteit): boolean => {
    const userEmail = user?.email ?? ''

    // Admin can always edit/delete activities.
    if (isAdmin) {
      return true
    }

    // Log values to help debug why buttons are not appearing
    // eslint-disable-next-line no-console
    console.debug('isCreatorOfActivity check', {
      activityId: activity.id,
      activityCreatedBy: activity.createdBy,
      userEmail,
    })

    if (!userEmail) return false

    // If activity has createdBy, check if it matches (case-insensitive)
    if (activity.createdBy) {
      return activity.createdBy.toLowerCase() === userEmail.toLowerCase()
    }

    // If there's no createdBy, do NOT assume the current user is the creator.
    // Return false so only activities that explicitly record their creator
    // are editable/deletable. This avoids showing buttons to everyone.
    return false
  }


  const canEditSelectedActivity = selectedActivity !== null ? isCreatorOfActivity(selectedActivity) : false
  const dashboardSelectedActivity = dashboardSelected >= 0 && dashboardSelected < activiteiten.length
    ? activiteiten[dashboardSelected]
    : null
  const canEditDashboardSelectedActivity = dashboardSelectedActivity !== null
    ? isCreatorOfActivity(dashboardSelectedActivity)
    : false

  const favoriteActivities = favoriteActivityIds
    .map((activityId) => activiteiten.find((activity) => activity.id === activityId))
    .filter((activity): activity is Activiteit => Boolean(activity))

  const recommendedActivities = activiteiten
    .filter((activity) => !favoriteActivityIds.includes(Number(activity.id ?? -1)))
    .slice(0, 3)

  const dashboardStats = {
    totalActivities: activiteiten.length,
    myActivities: user ? activiteiten.filter((activity) => isCreatorOfActivity(activity)).length : 0,
    favoriteCount: favoriteActivities.length,
    upcomingCount: activiteiten.filter((activity) => (activity.status ?? '').toLowerCase() !== 'voltooid').length,
  }

  const toggleFavorite = (activityId?: number) => {
    if (typeof activityId !== 'number') {
      return
    }

    setFavoriteActivityIds((current) => (
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId]
    ))
  }

  // Get filtered activities based on user selection
  const displayedActiviteiten = showMyActivitiesOnly
    ? activiteiten.filter((activity) => isCreatorOfActivity(activity))
    : activiteiten

  const filteredDisplayedActiviteiten = displayedActiviteiten.filter((act) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (act.title || '').toLowerCase().includes(q) || (act.description || '').toLowerCase().includes(q) || (act.location || '').toLowerCase().includes(q)
  })

  const handleLogin = async (
    credentials: UserCredentials,
    mode: 'login' | 'register',
  ): Promise<string | undefined> => {
    // Handler voor het inloggen of registreren vanuit de Login component.
    // Roept de parent `onLogin` aan en verwerkt foutmeldingen.
    // Bij succes resetten we UI-state en schrijven we een log.
    const error = await onLogin(credentials, mode)
    if (error) {
      setLoginError(error)
      return error
    }

    setLoginError('')
    setSelectedIndex(null)
    setDashboardSelected(0)
    setShowForm(false)
    setShowLogin(false)
    addLog(`${new Date().toLocaleString()} - ${credentials.name} heeft ingelogd`)
    return undefined
  }

  const handleCancelLogin = () => {
    // Annuleert het login-scherm en reset login-gerelateerde state.
    setLoginError('')
    setShowLogin(false)
    setLoginAction(null)
  }

  const handleShowDashboard = () => {
    setSelectedIndex(null)
    setShowForm(false)
    setShowLogin(false)
    setLoginAction(null)
    setStatusMessage('')
    setLoginError('')
    setDashboardSelected(0)
  }

  const handleLogout = () => {
    // Handler voor uitloggen: logt gebeurtenis en roept parent `onLogout`.
    if (user) {
      addLog(`${new Date().toLocaleString()} - ${user.name} heeft uitgelogd`)
    }
    onLogout()
    setStatusMessage('Je bent uitgelogd.')
    setSelectedIndex(null)
    setShowForm(false)
    setShowLogin(false)
  }

  useEffect(() => {
    // Tijdelijke statusmeldingen automatisch verwijderen na 4 seconden.
    if (!statusMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setStatusMessage('')
    }, 4000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [statusMessage])

  const handleDashboardActivitySelect = (index: number) => {
    setDashboardSelected(index)
  }

  const handleEditByIndex = (index: number) => {
    // Start bewerkflow: zet formuliervelden op de geselecteerde activiteit
    // en toont het formulier. Controleert ook permissies (creator/admin).
    if (index < 0 || index >= activiteiten.length) {
      return
    }

    const selected = activiteiten[index]
    if (!isCreatorOfActivity(selected)) {
      setFormError('Je kunt alleen je eigen activiteiten bewerken.')
      return
    }

    setTitle(selected.title) //toont de titel van de geselecteerde activiteit in het formulier
    setDescription(selected.description)
    setDate(toInputDate(selected.date))
    setTime(selected.time)
    setLocation(selected.location)
    setCategory(selected.category ?? 'Algemeen')
    setMaxParticipants(typeof selected.maxParticipants === 'number' ? String(selected.maxParticipants) : '')
    setStatus(selected.status ?? 'gepland')
    setImage(selected.image)
    setEditingIndex(index)
    setSelectedIndex(null)
    setShowForm(true)  //toont het formulier voor bewerken
    setFieldErrors({})
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }

  const toInputDate = (value: string): string => {
    if (!value) return '' //Als de waarde leeg is of niet gedefinieerd, retourneer een lege string (geen datum geselecteerd).
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value //Als de waarde al in het formaat 'YYYY-MM-DD' is, retourneer deze direct (compatibel met input type="date").
    const parsed = new Date(value)
    if (!Number.isFinite(parsed.getTime())) return ''
    return parsed.toISOString().slice(0, 10)
  }

  const getFieldErrors = (field: string): string[] | undefined => {
    if (!fieldErrors) return undefined
    if (fieldErrors[field]) return fieldErrors[field]
    const capital = field.charAt(0).toUpperCase() + field.slice(1)
    if (fieldErrors[capital]) return fieldErrors[capital]
    const lower = field.toLowerCase()
    if (fieldErrors[lower]) return fieldErrors[lower]
    return undefined
  }


  const handleDashboardEdit = () => {
    handleEditByIndex(dashboardSelected)
  }

  const handleDetailsEdit = () => {
    if (selectedIndex === null) {
      return
    }

    handleEditByIndex(selectedIndex)
  }

  const handleDeleteByIndex = async (index: number) => {
    // Verwijdert een activiteit (backend indien mogelijk) en past lokale state aan.
    if (index < 0 || index >= activiteiten.length) {
      return
    }

    const selected = activiteiten[index]
    if (!isCreatorOfActivity(selected)) {
      setStatusMessage('Je kunt alleen je eigen activiteiten verwijderen.')
      return
    }

    const shouldDelete = window.confirm(`Weet je zeker dat je "${selected.title}" wilt verwijderen?`)
    if (!shouldDelete) {
      return
    }

    if (selected.id !== undefined) {
      try {
        await api.deleteActivity(selected.id)
      } catch {
        // fallback to local deletion
      }
    }

    setActiviteiten((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setSelectedIndex((current) => {
      if (current === null) {
        return null
      }
      if (current === index) {
        return null
      }
      return current > index ? current - 1 : current
    })
    setDashboardSelected((current) => {
      if (current === index) {
        return 0
      }
      return current > index ? current - 1 : current
    })
    setStatusMessage('Activiteit verwijderd.')
    addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Gebruiker'} verwijderde ${selected.title}`)
  }

  const handleDetailsDelete = async () => {
    if (selectedIndex === null) {
      return
    }

    await handleDeleteByIndex(selectedIndex)
  }

  const handleDashboardNew = () => {
    // Voorbereiden van formulier voor het aanmaken van een nieuwe activiteit.
    setSelectedIndex(null)
    setEditingIndex(null)
    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setLocation('')
    setCategory('Algemeen')
    setMaxParticipants('')
    setStatus('gepland')
    setImage('')
    setFormError('')
    setShowForm(true)
    setLoginAction(null)
    setFieldErrors({})
  }

  const handleDashboardDelete = async () => {
    await handleDeleteByIndex(dashboardSelected)
  }

  const handleExportJson = () => {
    // Exporteert activiteiten naar een JSON-bestand dat de gebruiker kan downloaden.
    const data = JSON.stringify(activiteiten, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'activiteiten-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleToggleAdd = () => {
    // Open/Sluit het formulier om een nieuwe activiteit toe te voegen.
    // Als gebruiker niet is ingelogd, toont het login-prompt eerst.
    if (!user) {
      setLoginAction('add')
      setShowLogin(true)
      return
    }

    if (showForm) {
      setShowForm(false)
    } else {
      setEditingIndex(null)
      setTitle('')
      setDescription('')
      setDate('')
      setTime('')
      setLocation('')
      setCategory('Algemeen')
      setMaxParticipants('')
      setStatus('gepland')
      setImage('')
      setFormError('')
      setFieldErrors({})
      setShowForm(true)
    }
  }

  // Admin helper: probeer expliciet backend endpoints en toon resultaat
  const testLoadBackendActivities = async () => {
    const endpoints = [`${api.API_BASE}/activities`]

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { headers: getAuthHeaders() })
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          setStatusMessage(`Fetch ${url} faalde: ${resp.status} ${txt}`)
          continue
        }
        const parsed = await resp.json()
        setStatusMessage(`Succes: ${url} retourneerde ${Array.isArray(parsed) ? parsed.length : 'n.v.t.'} activiteiten`)
        setActiviteiten((parsed ?? []).map(normalizeActivity).map(resolveActivityOwner))
        return
      } catch (err) {
        setStatusMessage(`Fout bij ophalen ${url}: ${String(err)}`)
      }
    }
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Leest een geüpload beeldbestand in als data-URL en slaat het op in state.
    const file = event.target.files?.[0]
    if (!file) {
      setImage('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // Verwerkt het opslaan of bijwerken van een activiteit vanuit het formulier.
    // - Valideert velden
    // - Roept backend aan (create/update) en valt terug op lokale opslag bij falen
    // - Update lokale state en logs
    event.preventDefault()
    setFormError('')
    setFieldErrors({})

    const baseActivity = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'Algemeen',
      date: date.trim() || 'Datum nog in te vullen',
      time: time.trim() || 'Tijd nog in te vullen',
      location: location.trim(),
      maxParticipants: Number(maxParticipants) || undefined,
      status: status.trim() || 'gepland',
      image,
    }

    if (editingIndex !== null) {
      const activityToEdit = activiteiten[editingIndex]
      if (!activityToEdit) {
        setFormError('Wijzigen mislukt: activiteit niet gevonden.')
        return
      }

      const submittedTitle = title.trim() || activityToEdit.title || ''
      const submittedDescription = description.trim() || activityToEdit.description || ''
      const submittedDate = date.trim() || activityToEdit.date || 'Datum nog in te vullen'
      const submittedTime = time.trim() || activityToEdit.time || 'Tijd nog in te vullen'
      const submittedLocation = location.trim() || activityToEdit.location || ''
      const submittedCategory = category.trim() || activityToEdit.category || 'Algemeen'
      const submittedMaxParticipants = Number(maxParticipants) || activityToEdit.maxParticipants
      const submittedStatus = status.trim() || activityToEdit.status || 'gepland'

      const updatedActivity: Activiteit = {
        ...activityToEdit,
        title: submittedTitle,
        description: submittedDescription,
        category: submittedCategory,
        date: submittedDate,
        time: submittedTime,
        location: submittedLocation,
        maxParticipants: submittedMaxParticipants,
        status: submittedStatus,
        image: image,
      }

      if (activityToEdit.id !== undefined) {
        try {
          const updated = await api.updateActivity(activityToEdit.id, {
            title: submittedTitle,
            Title: submittedTitle,
            description: submittedDescription,
            Description: submittedDescription,
            category: submittedCategory,
            Category: submittedCategory,
            date: submittedDate,
            Date: submittedDate,
            time: submittedTime,
            Time: submittedTime,
            location: submittedLocation,
            Location: submittedLocation,
            maxParticipants: submittedMaxParticipants,
            MaxParticipants: submittedMaxParticipants,
            status: submittedStatus,
            Status: submittedStatus,
            image,
            Image: image,
            participants: activityToEdit.participants,
            participantsList: activityToEdit.participantsList,
            registrations: toApiRegistrations(activityToEdit.registrations),
            createdBy: activityToEdit.createdBy,
          })
          const normalizedUpdated = resolveActivityOwner(normalizeActivity(updated))
          rememberActivityOwner(normalizedUpdated, activityToEdit.createdBy ?? user?.email)
          setActiviteiten((current) =>
            current.map((item, index) => (index === editingIndex ? normalizedUpdated : item)),
          )
          setStatusMessage('Activiteit bijgewerkt.')
          addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} wijzigde ${updated.title}`)
        } catch (error) {
          if (error instanceof api.ValidationError) {
            setFieldErrors(error.errors ?? {})
            setFormError(Object.values(error.errors ?? {}).flat().join('; '))
            return
          }

          const message = String((error as Error)?.message ?? '')
          if (message.toLowerCase().includes('location') || message.toLowerCase().includes('validation')) {
            setFormError(message || 'Locatie mag niet leeg zijn.')
            return
          }

          setActiviteiten((current) =>
            current.map((item, index) => (index === editingIndex ? updatedActivity : item)),
          )
          setStatusMessage('Activiteit lokaal bijgewerkt (backend niet beschikbaar).')
          addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} wijzigde ${updatedActivity.title} (lokaal)`)
        }
      } else {
        setActiviteiten((current) =>
          current.map((item, index) => (index === editingIndex ? updatedActivity : item)),
        )
        setStatusMessage('Activiteit bijgewerkt.')
        addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} wijzigde ${updatedActivity.title}`)
      }
    } else {
      const nextIndex = activiteiten.length

      try {
        const created = await api.createActivity({   // Dit roept een API-functie aan om iets op te slaan
          ...baseActivity,
          participants: 0,
          participantsList: [],
          registrations: [],
          createdBy: user?.email,
        })

//Dit stuk code probeert eerst een activiteit via de backend/API op te slaan.
//Als dat mislukt, slaat h ij de activiteit lokaal op.
//Maakt data netjes/consistent voordat het in de app wordt gebruikt of opgeslagen, en houdt bij wie de activiteit heeft gemaakt voor permissies.

        const normalizedCreated = resolveActivityOwner(normalizeActivity(created))
        rememberActivityOwner(normalizedCreated, user?.email)
        setActiviteiten((current) => [...current, normalizedCreated])
          setShowMyActivitiesOnly(true)
          setSelectedIndex(nextIndex)
          setDashboardSelected(nextIndex)
        setStatusMessage('Activiteit opgeslagen.')
        addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} maakte ${created.title} aan`)
      } catch (error) {
        if (error instanceof api.ValidationError) {
          setFieldErrors(error.errors ?? {})
          setFormError(Object.values(error.errors ?? {}).flat().join('; '))
          return
        }

        const localCreated: Activiteit = resolveActivityOwner(normalizeActivity({
          id: Date.now(),
          ...baseActivity,
          participants: 0,
          participantsList: [],
          registrations: [],
          createdBy: user?.email,
        }))

        rememberActivityOwner(localCreated, user?.email)
        setActiviteiten((current) => [...current, localCreated])
        setShowMyActivitiesOnly(true)
        setSelectedIndex(nextIndex)
        setDashboardSelected(nextIndex)
        setStatusMessage('Activiteit lokaal opgeslagen. De backend is niet beschikbaar.')
        addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} maakte ${localCreated.title} aan (lokaal)`)
      }
    }

    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setLocation('')
    setCategory('Algemeen')
    setMaxParticipants('')
    setStatus('gepland')
    setImage('')
    setEditingIndex(null)
    setImageFileKey((current) => current + 1)
    setShowForm(false)
  }

  const handleSelectActivity = (index: number) => {
    // Geselecteerde activiteit openen in details-weergave.
    setSelectedIndex(index)
    setShowForm(false)
  }

  const handleBack = async () => {
    // Ga terug naar het activiteitenoverzicht. Probeert polls te verversen
    // zodat pas opgeslagen stemmen zichtbaar worden in de lijst.
    try {
      await refreshPolls()
    } catch {
      // ignore
    }
    setSelectedIndex(null)
  }

  useEffect(() => {
    if (selectedUserRegistration) {
      setSelectedStatusChoice(selectedUserRegistration.status)
      return
    }

    setSelectedStatusChoice('zeker')
  }, [selectedUserRegistration, selectedIndex])

  const handleSelectStatusChoice = (status: ParticipationStatus) => {
    // Wijzigt de geselecteerde inschrijfstatus in de details-weergave.
    setSelectedStatusChoice(status)
  }

  const handleRegister = () => {
    // Verwerkt inschrijven: past lokale activiteitstate aan en
    // probeert de update naar backend te sturen (fallback lokaal).
    if (!user) {
      setLoginAction(null)
      setShowLogin(true)
      return
    }

    if (selectedIndex === null) {
      return
    }

    const activity = activiteiten[selectedIndex]

    const existingIndex = activity.registrations.findIndex((entry) => entry.userEmail === user.email)
    const updatedRegistrations = existingIndex >= 0
      ? activity.registrations.map((entry, index) =>
          index === existingIndex
            ? { ...entry, status: selectedStatusChoice }
            : entry,
        )
      : [...activity.registrations, { userEmail: user.email, userName: user.name, status: selectedStatusChoice }]

    const updatedParticipantsList = updatedRegistrations
      .filter((entry) => entry.status === 'zeker')
      .map((entry) => entry.userName)

    const updatedActivity = {
      ...activity,
      registrations: updatedRegistrations,
      participantsList: updatedParticipantsList,
      participants: updatedParticipantsList.length,
    }

    const activityId = activity.id


    // map() loopt door alle activiteiten.
//Als index === selectedIndex:
//vervang dat item met updatedActivity.
//Anders:→ laat het oude item staan.
//Daarna slaat setActiviteiten de nieuwe lijst op in React state.
    setActiviteiten((current) =>
      current.map((item, index) => (index === selectedIndex ? updatedActivity : item)),
    )
 
    if (activityId === undefined) {
      setStatusMessage('Status lokaal bijgewerkt, maar backend-ID ontbreekt.')
      return
    }

    api.updateActivity(activityId, {
      participants: updatedActivity.participants,
      participantsList: updatedActivity.participantsList,
      registrations: toApiRegistrations(updatedActivity.registrations),

    }).then(async () => {
      await api.upsertRegistration({
        activityId,
        userEmail: user.email,
        userName: user.name,
        status: toApiRegistrationStatus(selectedStatusChoice),
      })

      setStatusMessage('Je inschrijfstatus is opgeslagen.')
      addLog(`${new Date().toLocaleString()} - ${user.name} koos "${selectedStatusChoice}" voor ${activity.title}`)
    }).catch(() => {
      setStatusMessage('Opslaan mislukt: de backend staat niet aan of geeft een fout terug.')
    })
  }

  const handleLeave = () => {
    // Verwerkt uitschrijven: verwijdert registratie en probeert backend bij te werken.
    if (!user || selectedIndex === null) {
      return
    }

    const activity = activiteiten[selectedIndex]
    const updatedRegistrations = activity.registrations.filter((entry) => entry.userEmail !== user.email)
    const updatedParticipantsList = updatedRegistrations
      .filter((entry) => entry.status === 'zeker')
      .map((entry) => entry.userName)

    const updatedActivity = {
      ...activity,
      registrations: updatedRegistrations,
      participantsList: updatedParticipantsList,
      participants: updatedParticipantsList.length,
    }

    const activityId = activity.id

    setActiviteiten((current) =>
      current.map((item, index) => (index === selectedIndex ? updatedActivity : item)),
    )

    if (activityId === undefined) {
      setStatusMessage('Uitschrijven lokaal bijgewerkt, maar backend-ID ontbreekt.')
      return
    }

    api.updateActivity(activityId, {
      participants: updatedActivity.participants,
      participantsList: updatedActivity.participantsList,
      registrations: toApiRegistrations(updatedActivity.registrations),

    }).then(async () => {
      const existingRegistration = await api.findRegistrationByActivityAndUser(activityId, user.email)
      if (existingRegistration?.id !== undefined) {
        await api.deleteRegistration(existingRegistration.id)
      }

      setStatusMessage('Je bent uitgeschreven voor deze activiteit.')
      addLog(`${new Date().toLocaleString()} - ${user.name} schreef zich uit voor ${activity.title}`)
    }).catch(() => {
      setStatusMessage('Opslaan mislukt: de backend staat niet aan of geeft een fout terug.')
    })
  }

  const handleRate = async (rating: number) => {
    // Verwerkt een stem van de gebruiker voor de geselecteerde activiteit.
    // - Roept `api.upsertPoll` aan om de stem te updaten/aan te maken op de backend.
    // - Stuurt `userId` mee wanneer beschikbaar (voor ASP.NET backend compatibiliteit).
    // - Update lokale state direct zodat de UI snel reageert.
    // - Bij fouten (backend offline) wordt de stem lokaal opgeslagen met `addPendingPoll`
    //   en wordt de UI bijgewerkt met een tijdelijke (pending) poll.
    if (!user || !selectedActivity || selectedActivity.id === undefined || !isRegistered) {
      return
    }

    try {
      const savedPoll = await api.upsertPoll({
        activityId: selectedActivity.id,
        userEmail: user.email,
        userName: user.name,
        rating,
        ...(typeof (user as any).id === 'number' && { userId: (user as any).id }),
      } as any)

      const normalizedSavedPoll = {
        ...savedPoll,
        rating: normalizeRating((savedPoll as Poll & { participation?: ParticipationStatus }).rating ?? (savedPoll as Poll & { participation?: ParticipationStatus }).participation),
      }

      setPolls((current) => {
        if (normalizedSavedPoll.id !== undefined) {
          const hasById = current.some((poll) => poll.id === normalizedSavedPoll.id)
          if (hasById) {
            return current.map((poll) => (poll.id === normalizedSavedPoll.id ? normalizedSavedPoll : poll))
          }
        }

        const existingIndex = current.findIndex(
          (poll) => poll.activityId === normalizedSavedPoll.activityId && typeof poll.userEmail === 'string' && typeof normalizedSavedPoll.userEmail === 'string' && poll.userEmail.toLowerCase() === normalizedSavedPoll.userEmail.toLowerCase(),
        )

        if (existingIndex >= 0) {
          return current.map((poll, index) => (index === existingIndex ? normalizedSavedPoll : poll))
        }

        return [...current, normalizedSavedPoll]
      })

      setStatusMessage('Je pollscore is opgeslagen.')
      addLog(`${new Date().toLocaleString()} - ${user.name} gaf ${rating}/5 voor ${selectedActivity.title}`)
      // Refresh polls from backend to ensure UI shows latest data
      await refreshPolls()
    } catch (err) {
      console.error('[handleRate] Error saving poll:', err)
      // save pending poll locally so the user's vote is not lost
      try {
        const pending = api.addPendingPoll({ activityId: selectedActivity.id, userEmail: user.email, userName: user.name, rating })

        // update UI immediately with the pending vote
        setPolls((current) => {
          const existingIndex = current.findIndex(
            (poll) => poll.activityId === pending.activityId && typeof poll.userEmail === 'string' && typeof pending.userEmail === 'string' && poll.userEmail.toLowerCase() === pending.userEmail.toLowerCase(),
          )
//maakt een nieuwe variabel aan,, .De waarden worden gekopieerd uit pending.
          const pendingPoll: Poll = {
            activityId: pending.activityId,
            userEmail: pending.userEmail,
            userName: pending.userName,
            rating: pending.rating,
            createdAt: pending.createdAt,
            updatedAt: pending.createdAt,
          }

          if (existingIndex >= 0) {
            return current.map((p, i) => (i === existingIndex ? pendingPoll : p))
          }

          return [...current, pendingPoll]
        })

        setStatusMessage('Backend offline — je stem is lokaal opgeslagen en wordt later gesynchroniseerd.')
        addLog(`${new Date().toLocaleString()} - ${user.name} gaf ${rating}/5 (lokaal opgeslagen) voor ${selectedActivity.title}`)
      } catch (fallbackErr) {
        console.error('[handleRate] Error saving poll locally:', fallbackErr)
        setStatusMessage('Stem opslaan mislukt: kon niet lokaal opslaan.')
      }
    }
  }

  // Try to flush any pending polls from local storage when app starts or user changes
  useEffect(() => {
    let mounted = true
    async function tryFlush() {
      // Probeert lokaal opgeslagen stemmen (pending) door te sturen naar de backend.
      // Bij succesvolle synchronisatie worden logs toegevoegd en de polls ververst.
      try {
        const result = await api.flushPendingPolls()
        if (!mounted) return
        if (result.success.length > 0) {
          // refresh polls from backend after successful sync
          result.success.forEach((p) => addLog(`${new Date(p.createdAt).toLocaleString()} - Gesynchroniseerde stem voor activiteit ${p.activityId} door ${p.userName}`))
          setStatusMessage('Lokaal opgeslagen stemmen zijn succesvol gesynchroniseerd met de backend.')
          await refreshPolls()
        }
      } catch {
        // ignore flush errors
      }
    }

    void tryFlush()

    return () => {
      mounted = false
    }
  }, [user])

  // Render logica: banner, header en main content.
  // Main content wisselt tussen:
  // - Login scherm
  // - Admin dashboard
  // - Activiteiten details (selectedActivity)
  // - Overzicht met lijst en formulier
  return (
    <div className="activiteiten-page">
      <div className="activiteiten-banner">
        <div className="activiteiten-banner-inner">
          <div className="banner-media">
            <div className="banner-visual" aria-hidden="true">
              <span className="banner-orb banner-orb-a" />
              <span className="banner-orb banner-orb-b" />
              <div className="banner-visual-card banner-visual-main">
                <span className="banner-visual-label">Vandaag</span>
                <strong>8 activiteiten</strong>
                <p>Snelle planning, helder overzicht en direct actie.</p>
              </div>
              <div className="banner-visual-card banner-visual-top">
                <span className="banner-visual-chip">Uitgelicht</span>
                <strong>Structuur</strong>
              </div>
              <div className="banner-visual-card banner-visual-bottom">
                <span className="banner-visual-chip secondary">Favorieten</span>
                <strong>Persoonlijk dashboard</strong>
              </div>
            </div>
          </div>
          <div className="activiteiten-banner-text">
            <span className="banner-kicker">Plan, deel en beheer</span>
            <h1>Activiteitenplanner</h1>
            <p className="banner-subtitle">Plan, deel en beheer interne en publieke activiteiten eenvoudig — overzichtelijk en samen.</p>
            <div style={{ marginTop: 14 }}>
              <button className="activiteiten-button" type="button" onClick={() => { setShowForm(true); setShowLogin(false); }}>Nieuwe activiteit</button>
            </div>
          </div>
        </div>
      </div>
      <header className="activiteiten-header">
        <div className="header-left">
          <div className="logo-wrap">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect width="24" height="24" rx="6" fill="#fff" opacity="0.06"/>
              <path d="M6 12h12M6 8h12M6 16h8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="logo-text">Activiteitenplanner</div>
          </div>
          <nav className="header-nav" aria-label="Hoofd navigatie">
            <button className="nav-button active" type="button">Overzicht</button>
          </nav>
        </div>
        <div className="header-right">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Zoek activiteiten, locatie of omschrijving"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Zoek activiteiten"
            />
          </div>
          <div className="user-panel">
          {user ? (
            <>
              <span>Ingelogd als {user.name}</span>
              {isAdmin && (
                <button className="logout-button" type="button" onClick={handleShowDashboard}>
                  Dashboard
                </button>
              )}
              <button className="logout-button" type="button" onClick={onShowChangePassword}>
                Wachtwoord wijzigen
              </button>
              <button className="logout-button" type="button" onClick={handleLogout}>
                Uitloggen
              </button>
            </>
          ) : (
            <>
              <span>Niet ingelogd</span>
              <button
                className="logout-button"
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setLoginAction(null)
                  setLoginError('')
                  setShowLogin(true)
                }}
              >
                Inloggen
              </button>
            </>
          )}
          </div>
        </div>
      </header>
      <main className="activiteiten-main">
        {statusMessage ? <div className="logout-message">{statusMessage}</div> : null}
        {user && !showLogin && selectedActivity === null && (
          <section className="personal-dashboard">
            <div className="personal-dashboard-header">
              <div>
                <p className="personal-dashboard-kicker">Mijn dashboard</p>
                <h2>Welkom terug, {user.firstName ?? user.name}</h2>
                <p className="personal-dashboard-role">Actieve rol: {roleLabel}</p>
              </div>
              <button type="button" className="activiteiten-toggle-button" onClick={() => setShowForm(true)}>
                Nieuwe activiteit
              </button>
            </div>
            <div className="dashboard-summary-grid">
              <article className="dashboard-summary-card">
                <span className="dashboard-summary-label">Favorieten</span>
                <strong>{dashboardStats.favoriteCount}</strong>
                <p>Je opgeslagen activiteiten blijven hier snel terug te vinden.</p>
              </article>
              <article className="dashboard-summary-card">
                <span className="dashboard-summary-label">Mijn activiteiten</span>
                <strong>{dashboardStats.myActivities}</strong>
                <p>Alle activiteiten die jij hebt aangemaakt of beheert.</p>
              </article>
              <article className="dashboard-summary-card">
                <span className="dashboard-summary-label">AI-aanbeveling</span>
                <strong>{recommendedActivities[0]?.title ?? 'Nog geen match'}</strong>
                <p>{recommendedActivities[0]?.category ?? 'Algemene inspiratie op basis van je overzicht.'}</p>
              </article>
              <article className="dashboard-summary-card">
                <span className="dashboard-summary-label">Actief overzicht</span>
                <strong>{dashboardStats.upcomingCount}</strong>
                <p>Toekomstige of nog openstaande activiteiten.</p>
              </article>
            </div>
            <div className="dashboard-insights">
              <div>
                <h3>Persoonlijke AI</h3>
                <p>
                  Op basis van je rol, favorieten en lopende activiteiten worden hier later externe AI-aanbevelingen en samenvattingen aangesloten.
                </p>
              </div>
              <div>
                <h3>Snelle acties</h3>
                <p>Profiel beheren, favorieten bekijken en direct doorgaan naar de activiteit die je nodig hebt.</p>
              </div>
            </div>
            {isBusinessAccount && (
              <div className="business-dashboard-shell">
                <div className="business-dashboard-header">
                  <div>
                    <p className="personal-dashboard-kicker">Bedrijfsdashboard</p>
                    <h3>Restaurants, cafés, escape rooms en andere partners</h3>
                  </div>
                  <span className="business-dashboard-badge">Business model</span>
                </div>
                <div className="business-dashboard-grid">
                  <article className="business-dashboard-card">
                    <strong>Beschikbaarheid</strong>
                    <p>Open blokken, bezetting en live capaciteit instellen.</p>
                  </article>
                  <article className="business-dashboard-card">
                    <strong>Arrangementen</strong>
                    <p>Groepsreserveringen, deals en pakketten aanbieden.</p>
                  </article>
                  <article className="business-dashboard-card">
                    <strong>Promoties</strong>
                    <p>Betaalde promoties en uitgelichte activiteiten plaatsen.</p>
                  </article>
                  <article className="business-dashboard-card">
                    <strong>Statistieken</strong>
                    <p>Reserveringen, conversie en bezettingscijfers bekijken.</p>
                  </article>
                </div>
                <div className="business-dashboard-footer">
                  Premium-abonnementen, commissies op reserveringen en bedrijfsabonnementen kunnen hier later worden aangesloten.
                </div>
              </div>
            )}
            <div className="business-model-grid" aria-label="Platform model">
              <article className="business-model-card">
                <strong>Gebruikersrollen</strong>
                <p>Gast, User, Bedrijf en Admin met rolgebaseerde toegang.</p>
              </article>
              <article className="business-model-card">
                <strong>AI-functionaliteit</strong>
                <p>Beschrijvingen, matching, aanbevelingen en moderatie via een externe API.</p>
              </article>
              <article className="business-model-card">
                <strong>Verdienmodel</strong>
                <p>Premium, commissies, betaalde promoties, bedrijfsabonnementen en betaalde events.</p>
              </article>
            </div>
          </section>
        )}
          {showLogin ? (
          <Login
            onLogin={handleLogin}
            onCancel={handleCancelLogin}
            error={loginError}
          />
        ) : isAdmin && !showForm && selectedActivity === null ? (
          <ActiviteitenDashboard
            activiteiten={activiteiten}
            activeIndex={dashboardSelected}
            onSelectActivity={handleDashboardActivitySelect}
            canEditSelectedActivity={canEditDashboardSelectedActivity}
            onEditActivity={handleDashboardEdit}
            onDeleteActivity={handleDashboardDelete}
            onNewActivity={handleDashboardNew}
            onExportData={handleExportJson}
            polls={polls}
          />
        ) : selectedActivity ? (
          <ActiviteitenDetails
            activiteit={selectedActivity}
            user={user}
            onBack={handleBack}
            onSelectStatusChoice={handleSelectStatusChoice}
            onRegister={handleRegister}
            onLeave={handleLeave}
            onRate={handleRate}
            onEditActivity={handleDetailsEdit}
            onDeleteActivity={handleDetailsDelete}
            isRegistered={isRegistered}
            canEditActivity={canEditSelectedActivity}
            selectedStatusChoice={selectedStatusChoice}
            userStatus={selectedUserRegistration?.status ?? null}
            statusCounts={selectedStatusCounts}
            totalResponses={selectedActivity.registrations.length}
            userRating={userRating}
            averageRating={averageRating}
            totalRatings={selectedActivityPolls.length}
          />
        ) : (
          <>
            <section className="activiteiten-add">
              <div className="activiteiten-add-header">
                <div>
                  <h2>Nieuwe activiteit toevoegen</h2>
                  <p className="activiteiten-add-text">
                    Voeg hier een nieuwe interne activiteit toe voor het IndustrieON-team.
                  </p>
                </div>
                {user && (
                  <button
                    type="button"
                    className="activiteiten-toggle-button"
                    onClick={handleToggleAdd}
                  >
                    {showForm ? 'Verberg formulier' : 'Activiteit toevoegen'}
                  </button>
                )}
              </div>
              {!user && (
                <div className="aanmelden-center">
                  <button
                    type="button"
                    className="activiteiten-toggle-button"
                    onClick={handleToggleAdd}
                  >
                    Aanmelden om toe te voegen
                  </button>
                </div>
              )}
              {user && showForm && (
                <form className="activiteiten-form" onSubmit={handleSubmit}>
                  {formError ? <div className="form-error">{formError}</div> : null}
                  <div className="form-group">
                    <label htmlFor="title">Titel</label>
                    <input
                      id="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="form-input"
                      placeholder="Bijv. Workshop IoT"
                    />
                    {getFieldErrors('title') ? (
                      <div className="field-errors">{getFieldErrors('title')!.join('; ')}</div>
                    ) : null}
                  </div>
                  <div className="form-group">
                    <label htmlFor="description">Beschrijving</label>
                    <div className="rte-toolbar" style={{ marginBottom: 6 }}>
                      <button type="button" onClick={() => applyFormat('bold')} aria-label="Bold">B</button>
                      <button type="button" onClick={() => applyFormat('italic')} aria-label="Italic">I</button>
                      <button type="button" onClick={() => applyFormat('underline')} aria-label="Underline">U</button>
                      <select onChange={(e) => applyFormat('fontSize', e.target.value)} defaultValue="3" aria-label="Font size">
                        <option value="1">Small</option>
                        <option value="3">Normal</option>
                        <option value="5">Large</option>
                        <option value="7">Huge</option>
                      </select>
                      <input type="color" onChange={(e) => applyFormat('foreColor', e.target.value)} title="Text color" style={{ marginLeft: 8 }} />
                      <button type="button" onClick={() => { if (editorRef.current) { editorRef.current.innerHTML = ''; setDescription('') } }}>Clear</button>
                    </div>

                    <div
                      id="description"
                      ref={editorRef}
                      contentEditable
                      role="textbox"
                      aria-multiline
                      onInput={() => setDescription(editorRef.current?.innerHTML ?? '')}
                      className="form-input"
                      style={{ minHeight: 80, border: '1px solid #ccc', padding: 8, borderRadius: 4, overflow: 'auto' }}
                      suppressContentEditableWarning
                    />

                    {getFieldErrors('description') ? (
                      <div className="field-errors">{getFieldErrors('description')!.join('; ')}</div>
                    ) : null}
                  </div>
                  <div className="form-group">
                    <label htmlFor="date">Datum</label>
                    <input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="time">Tijd</label>
                    <input
                      id="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      className="form-input"
                      placeholder="Bijv. 14:00 - 16:00"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="location">Locatie</label>
                    <input
                      id="location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      className="form-input"
                      placeholder="Bijv. IndustrieON HQ"
                    />
                    {getFieldErrors('location') ? (
                      <div className="field-errors">{getFieldErrors('location')!.join('; ')}</div>
                    ) : null}
                  </div>
                  <div className="form-grid-two">
                    <div className="form-group">
                      <label htmlFor="category">Categorie</label>
                      <input
                        id="category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="form-input"
                        placeholder="Bijv. Workshop, Netwerk, Sport"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="maxParticipants">Max. deelnemers</label>
                      <input
                        id="maxParticipants"
                        type="number"
                        min="1"
                        value={maxParticipants}
                        onChange={(event) => setMaxParticipants(event.target.value)}
                        className="form-input"
                        placeholder="Bijv. 25"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      className="form-input"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="concept">Concept</option>
                      <option value="gepland">Gepland</option>
                      <option value="gepubliceerd">Gepubliceerd</option>
                      <option value="voltooid">Voltooid</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="image">Afbeelding</label>
                    <input
                      key={imageFileKey}
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="form-input-file"
                    />
                  </div>
                  {image && (
                    <div className="image-preview">
                      <img src={image} alt="Activiteit preview" />
                    </div>
                  )}
                  <button className="activiteiten-button" type="submit">
                    {editingIndex !== null ? 'Activiteit bijwerken' : 'Activiteit opslaan'}
                  </button>
                </form>
              )}
            </section>

            <section className="activiteiten-filter">
              <div className="activiteiten-filter-header">
                <h2>Activiteiten overzicht</h2>
                {isAdmin && (
                  <div style={{ marginLeft: 12 }}>
                    <button type="button" className="filter-button" onClick={testLoadBackendActivities}>
                      Laad backend-activiteiten
                    </button>
                  </div>
                )}
                {/* Debug panel: toont welke endpoints geprobeerd zijn en korte fout/response info */}
                {debugAttempts.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <details>
                      <summary>Debug: backend pogingen ({debugAttempts.length})</summary>
                      <ul>
                        {debugAttempts.map((a, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <li key={i} style={{ fontSize: 12 }}>
                            <strong>{a.url}</strong> — {a.ok ? `OK (${a.status ?? ''})` : `FAILED`} {a.status ? `status:${a.status}` : ''}
                            {a.error ? ` error: ${a.error}` : ''}
                            {a.body ? ` body: ${a.body}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
                {user && activiteiten.some((act) => isCreatorOfActivity(act)) && (
                  <div className="activiteiten-filter-buttons">
                    <button
                      type="button"
                      className={`filter-button ${!showMyActivitiesOnly ? 'active' : ''}`}
                      onClick={() => setShowMyActivitiesOnly(false)}
                    >
                      Alle activiteiten
                    </button>
                    <button
                      type="button"
                      className={`filter-button ${showMyActivitiesOnly ? 'active' : ''}`}
                      onClick={() => setShowMyActivitiesOnly(true)}
                    >
                      Mijn activiteiten ({activiteiten.filter((act) => isCreatorOfActivity(act)).length})
                    </button>
                  </div>
                )}
              </div>
            </section>

            <div className="activiteiten-list">
              {filteredDisplayedActiviteiten.length > 0 ? (
                filteredDisplayedActiviteiten.map((item) => {
                  const originalIndex = activiteiten.findIndex((a) => a.id === item.id)

                  // compute poll summary for this activity
                  const activityPolls = item.id !== undefined ? polls.filter((p) => p.activityId === item.id) : []
                  const activityAvg = activityPolls.length > 0
                    ? Number((activityPolls.reduce((s, p) => s + p.rating, 0) / activityPolls.length).toFixed(1))
                    : null
                  const userPoll = user && item.id !== undefined
                    ? activityPolls.find((p) => typeof p.userEmail === 'string' && typeof user.email === 'string' && p.userEmail.toLowerCase() === user.email.toLowerCase()) ?? null
                    : null

                  return (
                    <article
                      className="activiteiten-card"
                      key={`${item.title}-${originalIndex}`}
                      onClick={() => handleSelectActivity(originalIndex)}
                    >
                      {isCreatorOfActivity(item) && (
                        <div className="activiteiten-card-badge">Jouw activiteit</div>
                      )}
                      <div className="activiteiten-card-thumb">
                        {item.image ? (
                          <img src={item.image} alt={item.title} />
                        ) : (
                          'Afbeelding'
                        )}
                      </div>
                      <div className="activiteiten-card-content">
                        <div className="activiteiten-card-meta">
                          <span className="activiteiten-card-chip">{item.category || 'Algemeen'}</span>
                          <span className="activiteiten-card-chip secondary">{item.status || 'gepland'}</span>
                          {typeof item.maxParticipants === 'number' ? (
                            <span className="activiteiten-card-chip secondary">Max {item.maxParticipants}</span>
                          ) : null}
                        </div>
                        <h2>{item.title}</h2>
                        <p dangerouslySetInnerHTML={{ __html: sanitize(item.description) }} />
                        <div className="activiteiten-card-poll">
                          {activityAvg !== null ? (
                            <span className="poll-average">⭐ {activityAvg}/5 ({activityPolls.length})</span>
                          ) : (
                            <span className="poll-average">Nog geen beoordelingen</span>
                          )}
                          {userPoll ? (
                            <span className="poll-user"> — Jouw stem: {userPoll.rating}/5</span>
                          ) : null}
                        </div>
                        {isCreatorOfActivity(item) && (
                          <div className="activiteiten-card-actions">
                            <button
                              type="button"
                              className="activiteiten-button activiteiten-button-ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleFavorite(item.id)
                              }}
                            >
                              {item.id !== undefined && favoriteActivityIds.includes(item.id) ? 'Favoriet opgeslagen' : 'Opslaan als favoriet'}
                            </button>
                            <button
                              type="button"
                              className="activiteiten-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleEditByIndex(originalIndex)
                              }}
                            >
                              Bewerken
                            </button>
                            <button
                              type="button"
                              className="activiteiten-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteByIndex(originalIndex)
                              }}
                            >
                              Verwijderen
                            </button>
                          </div>
                        )}
                        {!isCreatorOfActivity(item) && item.id !== undefined && (
                          <div className="activiteiten-card-actions">
                            <button
                              type="button"
                              className="activiteiten-button activiteiten-button-ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleFavorite(item.id)
                              }}
                            >
                              {favoriteActivityIds.includes(item.id) ? 'Uit favorieten halen' : 'Opslaan als favoriet'}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="activiteiten-empty">
                  {showMyActivitiesOnly ? 'Je hebt nog geen activiteiten aangemaakt.' : 'Geen activiteiten beschikbaar.'}
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

// Footer is simple and informational
function Footer() {
  return (
    <footer className="site-footer">
      <div>Activiteitenplanner — IndustrieON</div>
      <div>Version 1.0</div>
    </footer>
  )
}

export default Activiteiten

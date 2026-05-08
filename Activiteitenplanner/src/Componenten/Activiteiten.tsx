import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import activiteitenData from '../data/activiteiten.json'
import * as api from '../api/api'
import Login from './Login'
import ActiviteitenDetails from './ActiviteitenDetails'
import ActiviteitenDashboard from './ActiviteitenDashboard'
import './Activiteiten.css'


//Er is een nieuw object met de volgende eigenschappen gemaakt: title, description, date, time, location, participants en image. Deze eigenschappen worden gebruikt om de details van een activiteit weer te geven en bij te houden hoeveel deelnemers er zijn.
type Activiteit = {
  id?: number
  title: string
  description: string
  date: string
  time: string
  location: string
  participants: number
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
  if (value === 'zeker' || value === 'misschien' || value === 'niet') {
    return value
  }

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

//Inloggen met naam, e-mail en wachtwoord. Deze gegevens worden gebruikt om gebruikers te identificeren en te bepalen of ze adminrechten hebben.
type UserCredentials = {
  name: string
  email: string
  password: string
  role?: 'admin'
}
//De Activiteiten component is het hoofdonderdeel van de applicatie. Het beheert de staat van activiteiten, gebruikers en de interacties tussen deze elementen. Het maakt gebruik van verschillende subcomponenten zoals Login, ActiviteitenDetails en ActiviteitenDashboard om specifieke functionaliteiten te bieden.
type ActiviteitenProps = {
  user: UserCredentials | null
  onLogin: (user: UserCredentials, mode: 'login' | 'register') => Promise<string | undefined>
  onLogout: () => void
  onShowChangePassword?: () => void
}

const STORAGE_KEY = 'industrieon-activiteiten'
const STORAGE_LOGS_KEY = 'industrieon-beheer-logs'
const STORAGE_ACTIVITY_OWNERS_KEY = 'industrieon-activity-owners'


type LoginAction = 'add' | 'join' | null

type ActivityOwnerMap = Record<string, string>

function loadActivityOwners(): ActivityOwnerMap {
  if (typeof window === 'undefined') {
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

function normalizeActivity(item: any): Activiteit {
  const rawId = Number(item.id)
  const id = Number.isFinite(rawId) ? rawId : undefined
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
    title: String(item.title ?? 'Onbekende activiteit'),
    description: String(item.description ?? ''),
    date: String(item.date ?? 'Datum nog in te vullen'),
    time: String(item.time ?? 'Tijd nog in te vullen'),
    location: String(item.location ?? 'Locatie nog in te vullen'),
    participants,
    participantsList,
    registrations,
    image: String(item.image ?? ''),
    createdBy: item.createdBy ? String(item.createdBy) : undefined,
  }
}

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

function loadLogs(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  return []
}

function Activiteiten({ user, onLogin, onLogout, onShowChangePassword }: ActiviteitenProps) {
  const [activiteiten, setActiviteiten] = useState<Activiteit[]>(() => loadActivities())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
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
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedStatusChoice, setSelectedStatusChoice] = useState<ParticipationStatus>('zeker')
  const [showMyActivitiesOnly, setShowMyActivitiesOnly] = useState(false)
  const [activityOwners, setActivityOwners] = useState<ActivityOwnerMap>(() => loadActivityOwners())

  const resolveActivityOwner = (activity: Activiteit): Activiteit => {
    if (activity.createdBy) {
      return activity
    }

    const owner = makeOwnerKeys(activity)
      .map((key) => activityOwners[key])
      .find((value) => typeof value === 'string' && value.length > 0)

    return owner ? { ...activity, createdBy: owner } : activity
  }

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

  const addLog = async (message: string) => {
    setLogs((current) => [message, ...current].slice(0, 100))

    try {
      await api.appendLog(message)
    } catch {
      // fallback to local storage if backend is unavailable
    }
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activiteiten))
  }, [activiteiten])

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs))
  }, [logs])

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVITY_OWNERS_KEY, JSON.stringify(activityOwners))
  }, [activityOwners])

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
      } catch {
        // fallback to local storage / default activities
      }
    }

    async function loadBackendLogs() {
      try {
        const backendLogs = await api.getLogs()
        setLogs(backendLogs.map((log) => `${new Date(log.createdAt).toLocaleString()} - ${log.message}`))
      } catch {
        // fallback to local browser logs
      }
    }

    async function loadBackendPolls() {
      try {
        const backendPolls = await api.getPolls()
        setPolls(
          backendPolls.map((poll) => ({
            ...poll,
            rating: normalizeRating((poll as Poll & { participation?: ParticipationStatus }).rating ?? (poll as Poll & { participation?: ParticipationStatus }).participation),
          })),
        )
      } catch {
        setPolls([])
      }
    }

    loadBackendActivities()
    loadBackendLogs()
    loadBackendPolls()
  }, [])

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
  }, [user, loginAction])

  const selectedActivity = selectedIndex !== null ? activiteiten[selectedIndex] : null
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
  const selectedActivityPolls = selectedActivity?.id !== undefined
    ? polls.filter((poll) => poll.activityId === selectedActivity.id)
    : []
  const userRating = selectedActivity?.id !== undefined && user
    ? polls.find((poll) => poll.activityId === selectedActivity.id && poll.userEmail === user.email)?.rating ?? null
    : null
  const averageRating = selectedActivityPolls.length > 0
    ? Number((selectedActivityPolls.reduce((sum, poll) => sum + poll.rating, 0) / selectedActivityPolls.length).toFixed(1))
    : null
  const isAdmin =
    user?.role === 'admin' ||
    user?.name.toLowerCase() === 'admin' ||
    user?.email.toLowerCase() === 'admin@admin.com'

  // Helper function to check if user is the creator of an activity
  const isCreatorOfActivity = (activity: Activiteit): boolean => {
    const userEmail = user?.email ?? ''

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

  // Get filtered activities based on user selection
  const displayedActiviteiten = showMyActivitiesOnly
    ? activiteiten.filter((activity) => isCreatorOfActivity(activity))
    : activiteiten

  const handleLogin = async (
    credentials: UserCredentials,
    mode: 'login' | 'register',
  ): Promise<string | undefined> => {
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
    setLoginError('')
    setShowLogin(false)
    setLoginAction(null)
  }

  const handleLogout = () => {
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
    if (index < 0 || index >= activiteiten.length) {
      return
    }

    const selected = activiteiten[index]
    if (!isCreatorOfActivity(selected)) {
      setFormError('Je kunt alleen je eigen activiteiten bewerken.')
      return
    }

    setTitle(selected.title)
    setDescription(selected.description)
    setDate(toInputDate(selected.date))
    setTime(selected.time)
    setLocation(selected.location)
    setImage(selected.image)
    setEditingIndex(index)
    setSelectedIndex(null)
    setShowForm(true)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }

  const toInputDate = (value: string): string => {
    if (!value) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const parsed = new Date(value)
    if (!Number.isFinite(parsed.getTime())) return ''
    return parsed.toISOString().slice(0, 10)
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
    setSelectedIndex(null)
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
  }

  const handleDashboardDelete = async () => {
    await handleDeleteByIndex(dashboardSelected)
  }

  const handleExportJson = () => {
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
      setImage('')
      setFormError('')
      setShowForm(true)
    }
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    event.preventDefault()
    setFormError('')

    if (!title.trim() || !description.trim()) {
      return
    }

    const baseActivity = {
      title: title.trim(),
      description: description.trim(),
      date: date.trim() || 'Datum nog in te vullen',
      time: time.trim() || 'Tijd nog in te vullen',
      location: location.trim() || 'Locatie nog in te vullen',
      image,
    }

    if (editingIndex !== null) {
      const activityToEdit = activiteiten[editingIndex]
      if (!activityToEdit) {
        setFormError('Wijzigen mislukt: activiteit niet gevonden.')
        return
      }

      const updatedActivity: Activiteit = {
        ...activityToEdit,
        ...baseActivity,
      }

      if (activityToEdit.id !== undefined) {
        try {
          const updated = await api.updateActivity(activityToEdit.id, {
            ...baseActivity,
            participants: activityToEdit.participants,
            participantsList: activityToEdit.participantsList,
            registrations: activityToEdit.registrations,
            createdBy: activityToEdit.createdBy,
          })
          const normalizedUpdated = resolveActivityOwner(normalizeActivity(updated))
          rememberActivityOwner(normalizedUpdated, activityToEdit.createdBy ?? user?.email)
          setActiviteiten((current) =>
            current.map((item, index) => (index === editingIndex ? normalizedUpdated : item)),
          )
          setStatusMessage('Activiteit bijgewerkt.')
          addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} wijzigde ${updated.title}`)
        } catch {
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
      const newActivity: Activiteit = {
        title: baseActivity.title,
        description: baseActivity.description,
        date: baseActivity.date,
        time: baseActivity.time,
        location: baseActivity.location,
        image: baseActivity.image,
        participants: 0,
        participantsList: [],
        registrations: [],
        createdBy: user?.email,
      }

      try {
        const created = await api.createActivity({
          ...baseActivity,
          participants: 0,
          participantsList: [],
          registrations: [],
          createdBy: user?.email,
        })
        const normalizedCreated = resolveActivityOwner(normalizeActivity(created))
        rememberActivityOwner(normalizedCreated, user?.email)
        setActiviteiten((current) => [...current, normalizedCreated])
        setStatusMessage('Activiteit opgeslagen.')
        addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} maakte ${created.title} aan`)
      } catch {
        setActiviteiten((current) => [...current, newActivity])
        rememberActivityOwner(newActivity, user?.email)
        setStatusMessage('Activiteit lokaal opgeslagen (backend niet beschikbaar).')
        addLog(`${new Date().toLocaleString()} - ${user?.name ?? 'Admin'} maakte ${newActivity.title} aan (lokaal)`)
      }
    }

    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setLocation('')
    setImage('')
    setEditingIndex(null)
    setImageFileKey((current) => current + 1)
    setShowForm(false)
  }

  const handleSelectActivity = (index: number) => {
    setSelectedIndex(index)
    setShowForm(false)
  }

  const handleBack = () => {
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
    setSelectedStatusChoice(status)
  }

  const handleRegister = () => {
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
      registrations: updatedActivity.registrations,

    }).then(async () => {
      await api.upsertRegistration({
        activityId,
        userEmail: user.email,
        userName: user.name,
        status: selectedStatusChoice,
      })

      setStatusMessage('Je inschrijfstatus is opgeslagen.')
      addLog(`${new Date().toLocaleString()} - ${user.name} koos "${selectedStatusChoice}" voor ${activity.title}`)
    }).catch(() => {
      setStatusMessage('Opslaan mislukt: de backend staat niet aan of geeft een fout terug.')
    })
  }

  const handleLeave = () => {
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
      registrations: updatedActivity.registrations,

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
    if (!user || !selectedActivity || selectedActivity.id === undefined || !isRegistered) {
      return
    }

    try {
      const savedPoll = await api.upsertPoll({
        activityId: selectedActivity.id,
        userEmail: user.email,
        userName: user.name,
        rating,
      })

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
          (poll) => poll.activityId === normalizedSavedPoll.activityId && poll.userEmail === normalizedSavedPoll.userEmail,
        )

        if (existingIndex >= 0) {
          return current.map((poll, index) => (index === existingIndex ? normalizedSavedPoll : poll))
        }

        return [...current, normalizedSavedPoll]
      })

      setStatusMessage('Je pollscore is opgeslagen.')
      addLog(`${new Date().toLocaleString()} - ${user.name} gaf ${rating}/5 voor ${selectedActivity.title}`)
    } catch {
      setStatusMessage('Stem opslaan mislukt: de backend staat niet aan of geeft een fout terug.')
    }
  }

  return (
    <div className="activiteiten-page">
      <div className="activiteiten-banner">
        <div className="activiteiten-banner-inner">
          <div className="banner-media">
            {/* Inline SVG icon so no external asset needed */}
            <svg width="84" height="84" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect width="24" height="24" rx="6" fill="#FFFFFF" opacity="0.06"/>
              <path d="M5 7h14M5 12h14M5 17h9" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="activiteiten-banner-text">
            <h1>Activiteitenplanner</h1>
            <p className="banner-subtitle">Uniek overzicht van IndustrieON-evenementen en teambuilding</p>
          </div>
        </div>
      </div>
      <header className="activiteiten-header">
        <div className="logo-text">IndustrieON</div>
        <div className="user-panel">
          {user ? (
            <>
              <span>Ingelogd als {user.name}</span>
              <button className="logout-button" type="button" onClick={onShowChangePassword}>
                Wachtwoord wijzigen
              </button>
              <button className="logout-button" type="button" onClick={handleLogout}>
                Uitloggen
              </button>
            </>
          ) : (
            <span>Niet ingelogd</span>
          )}
        </div>
      </header>
      <main className="activiteiten-main">
        {statusMessage ? <div className="logout-message">{statusMessage}</div> : null}
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
            <section className="activiteiten-intro">
              <div className="intro-title">
                <h1>Activiteiten</h1>
                <p className="subtitle">Overzicht van interne IndustrieON-teambuilding en sessies</p>
              </div>
            </section>

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
                  </div>
                  <div className="form-group">
                    <label htmlFor="description">Beschrijving</label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="form-input"
                      placeholder="Omschrijf de activiteit"
                      rows={3}
                    />
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
              {displayedActiviteiten.length > 0 ? (
                displayedActiviteiten.map((item) => {
                  const originalIndex = activiteiten.findIndex((a) => a.id === item.id)
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
                        <h2>{item.title}</h2>
                        <p>{item.description}</p>
                        {isCreatorOfActivity(item) && (
                          <div className="activiteiten-card-actions">
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
    </div>
  )
}

export default Activiteiten

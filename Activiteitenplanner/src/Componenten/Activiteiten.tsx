import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import activiteitenData from '../data/activiteiten.json'
import Login from './Login'
import ActiviteitenDetails from './ActiviteitenDetails'
import './Activiteiten.css'

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

type ActiviteitenProps = {
  user: UserCredentials | null
  onLogin: (user: UserCredentials) => void
  onLogout: () => void
}

const STORAGE_KEY = 'industrieon-activiteiten'

type LoginAction = 'add' | 'join' | null

function normalizeActivity(item: any): Activiteit {
  return {
    title: String(item.title ?? 'Onbekende activiteit'),
    description: String(item.description ?? ''),
    date: String(item.date ?? 'Datum nog in te vullen'),
    time: String(item.time ?? 'Tijd nog in te vullen'),
    location: String(item.location ?? 'Locatie nog in te vullen'),
    participants: Number(item.participants) || 0,
    image: String(item.image ?? ''),
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

function Activiteiten({ user, onLogin, onLogout }: ActiviteitenProps) {
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
  const [joinedActivities, setJoinedActivities] = useState<number[]>([])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activiteiten))
  }, [activiteiten])

  useEffect(() => {
    if (!user || !loginAction) {
      return
    }

    if (loginAction === 'add') {
      setShowForm(true)
      setLoginAction(null)
      return
    }

    if (loginAction === 'join' && selectedIndex !== null) {
      if (!joinedActivities.includes(selectedIndex)) {
        setJoinedActivities((current) => [...current, selectedIndex])
        setActiviteiten((current) =>
          current.map((item, index) =>
            index === selectedIndex
              ? { ...item, participants: item.participants + 1 }
              : item,
          ),
        )
      }
      setShowLogin(false)
      setLoginAction(null)
    }
  }, [user, loginAction, selectedIndex, joinedActivities])

  const selectedActivity = selectedIndex !== null ? activiteiten[selectedIndex] : null
  const isJoined = selectedIndex !== null && joinedActivities.includes(selectedIndex)

  const handleLogin = (credentials: UserCredentials) => {
    onLogin(credentials)
    setShowLogin(false)
  }

  const handleToggleAdd = () => {
    if (!user) {
      setLoginAction('add')
      setShowLogin(true)
      return
    }

    setShowForm((current) => !current)
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !description.trim()) {
      return
    }

    setActiviteiten((current) => [
      ...current,
      {
        title: title.trim(),
        description: description.trim(),
        date: date.trim() || 'Datum nog in te vullen',
        time: time.trim() || 'Tijd nog in te vullen',
        location: location.trim() || 'Locatie nog in te vullen',
        participants: 0,
        image,
      },
    ])
    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setLocation('')
    setImage('')
    setImageFileKey((current) => current + 1)
  }

  const handleSelectActivity = (index: number) => {
    setSelectedIndex(index)
    setShowForm(false)
  }

  const handleBack = () => {
    setSelectedIndex(null)
  }

  const handleJoin = () => {
    if (!user) {
      setLoginAction('join')
      setShowLogin(true)
      return
    }

    if (selectedIndex === null) {
      return
    }

    if (!joinedActivities.includes(selectedIndex)) {
      setJoinedActivities((current) => [...current, selectedIndex])
      setActiviteiten((current) =>
        current.map((item, index) =>
          index === selectedIndex
            ? { ...item, participants: item.participants + 1 }
            : item,
        ),
      )
    }
  }

  const handleLeave = () => {
    if (!user || selectedIndex === null) {
      return
    }

    if (joinedActivities.includes(selectedIndex)) {
      setJoinedActivities((current) => current.filter((item) => item !== selectedIndex))
      setActiviteiten((current) =>
        current.map((item, index) =>
          index === selectedIndex
            ? {
                ...item,
                participants: Math.max(0, item.participants - 1),
              }
            : item,
        ),
      )
    }
  }

  return (
    <div className="activiteiten-page">
      <header className="activiteiten-header">
        <div className="logo-text">IndustrieON</div>
        <div className="user-panel">
          {user ? (
            <>
              <span>Ingelogd als {user.name}</span>
              <button className="logout-button" type="button" onClick={onLogout}>
                Uitloggen
              </button>
            </>
          ) : (
            <span>Niet ingelogd</span>
          )}
        </div>
      </header>
      <main className="activiteiten-main">
        {showLogin ? (
          <Login onLogin={handleLogin} onCancel={() => setShowLogin(false)} />
        ) : selectedActivity ? (
          <ActiviteitenDetails
            activiteit={selectedActivity}
            user={user}
            isJoined={isJoined}
            onBack={handleBack}
            onJoin={handleJoin}
            onLeave={handleLeave}
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
                <button
                  type="button"
                  className="activiteiten-toggle-button"
                  onClick={handleToggleAdd}
                >
                  {user ? (showForm ? 'Verberg formulier' : 'Activiteit toevoegen') : 'Aanmelden om toe te voegen'}
                </button>
              </div>
              {user && showForm && (
                <form className="activiteiten-form" onSubmit={handleSubmit}>
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
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="form-input"
                      placeholder="Bijv. 12 mei 2026"
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
                    Activiteit opslaan
                  </button>
                </form>
              )}
            </section>

            <div className="activiteiten-list">
              {activiteiten.map((item, index) => (
                <article
                  className="activiteiten-card"
                  key={`${item.title}-${index}`}
                  onClick={() => handleSelectActivity(index)}
                >
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
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default Activiteiten

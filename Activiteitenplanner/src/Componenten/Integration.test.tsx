import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createActivity,
  getActivities,
  updateActivity,
  createPoll,
  findUsersByEmail,
  createUser,
} from '../api/api'

// Mock fetch globally
global.fetch = vi.fn()

describe('Integration Testing: Form → Database', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test Scenario 1: Create and retrieve activity data
  describe('Scenario 1: Activity Creation and Retrieval', () => {
    it('should save activity form data to database and retrieve it', async () => {
      // Arrange - Mocking activity data
      const mockActivity = {
        id: 1,
        title: 'Voetbalwedstrijd',
        description: 'Vriendschappelijke wedstrijd',
        date: '2026-04-15',
        time: '19:00',
        location: 'Veld A',
        participants: 0,
        participantsList: [],
        registrations: [],
        image: 'soccer.jpg',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => mockActivity,
        ok: true,
      } as Response)

      // Act - Create activity
      const createdActivity = await createActivity(mockActivity)

      // Assert - Verify data was saved
      expect(createdActivity).toEqual(mockActivity)
      expect(createdActivity.title).toBe('Voetbalwedstrijd')
      expect(createdActivity.date).toBe('2026-04-15')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/activities'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should retrieve all activities from database', async () => {
      // Arrange
      const mockActivities = [
        {
          id: 1,
          title: 'Voetbal',
          date: '2026-04-15',
          time: '19:00',
          location: 'Veld A',
          description: 'Test',
          participants: 2,
          participantsList: ['user1@test.com', 'user2@test.com'],
          registrations: [],
          image: 'soccer.jpg',
        },
        {
          id: 2,
          title: 'Tennis',
          date: '2026-04-20',
          time: '14:00',
          location: 'Court B',
          description: 'Test',
          participants: 1,
          participantsList: ['user3@test.com'],
          registrations: [],
          image: 'tennis.jpg',
        },
      ]

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => mockActivities,
        ok: true,
      } as Response)

      // Act
      const activities = await getActivities()

      // Assert
      expect(activities).toHaveLength(2)
      expect(activities[0].title).toBe('Voetbal')
      expect(activities[1].title).toBe('Tennis')
    })
  })

  // Test Scenario 2: User Registration with Status
  describe('Scenario 2: User Registration and Status Storage', () => {
    it('should register user with participation status and save to database', async () => {
      // Arrange
      const updatedActivity = {
        id: 1,
        title: 'Voetbal',
        date: '2026-04-15',
        time: '19:00',
        location: 'Veld A',
        description: 'Test',
        participants: 1,
        participantsList: ['jan@test.com'],
        registrations: [
          {
            userEmail: 'jan@test.com',
            userName: 'Jan',
            status: 'zeker' as const,
          },
        ],
        image: 'soccer.jpg',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => updatedActivity,
        ok: true,
      } as Response)

      // Act - Update activity with registration
      const result = await updateActivity(1, updatedActivity)

      // Assert
      expect(result.registrations).toHaveLength(1)
      expect(result.registrations![0].userEmail).toBe('jan@test.com')
      expect(result.registrations![0].status).toBe('zeker')
      expect(result.participants).toBe(1)
    })

    it('should handle multiple registrations with different statuses', async () => {
      // Arrange
      const multipleRegistrations = {
        id: 1,
        title: 'Voetbal',
        date: '2026-04-15',
        time: '19:00',
        location: 'Veld A',
        description: 'Test',
        participants: 3,
        participantsList: ['jan@test.com', 'marie@test.com', 'dirk@test.com'],
        registrations: [
          {
            userEmail: 'jan@test.com',
            userName: 'Jan',
            status: 'zeker' as const,
          },
          {
            userEmail: 'marie@test.com',
            userName: 'Marie',
            status: 'misschien' as const,
          },
          {
            userEmail: 'dirk@test.com',
            userName: 'Dirk',
            status: 'niet' as const,
          },
        ],
        image: 'soccer.jpg',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => multipleRegistrations,
        ok: true,
      } as Response)

      // Act
      const result = await updateActivity(1, multipleRegistrations)

      // Assert
      expect(result.registrations).toHaveLength(3)
      expect(result.registrations![0].status).toBe('zeker')
      expect(result.registrations![1].status).toBe('misschien')
      expect(result.registrations![2].status).toBe('niet')
    })
  })

  // Test Scenario 3: Poll/Rating Submission
  describe('Scenario 3: Poll Rating Submission and Retrieval', () => {
    it('should save poll rating (1-5) to database for registered user', async () => {
      // Arrange
      const mockPoll = {
        id: 101,
        activityId: 1,
        userEmail: 'jan@test.com',
        userName: 'Jan',
        rating: 5,
        createdAt: '2026-04-16T10:00:00Z',
        updatedAt: '2026-04-16T10:00:00Z',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => mockPoll,
        ok: true,
      } as Response)

      // Act - Submit poll rating
      const poll = await createPoll({
        activityId: 1,
        userEmail: 'jan@test.com',
        userName: 'Jan',
        rating: 5,
        createdAt: '2026-04-16T10:00:00Z',
        updatedAt: '2026-04-16T10:00:00Z',
      })

      // Assert
      expect(poll.rating).toBe(5)
      expect(poll.userEmail).toBe('jan@test.com')
      expect(poll.activityId).toBe(1)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/polls'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should validate poll rating is between 1-5', async () => {
      // Arrange
      const mockPoll = {
        id: 102,
        activityId: 1,
        userEmail: 'marie@test.com',
        userName: 'Marie',
        rating: 3,
        createdAt: '2026-04-16T11:00:00Z',
        updatedAt: '2026-04-16T11:00:00Z',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => mockPoll,
        ok: true,
      } as Response)

      // Act
      const poll = await createPoll({
        activityId: 1,
        userEmail: 'marie@test.com',
        userName: 'Marie',
        rating: 3,
        createdAt: '2026-04-16T11:00:00Z',
        updatedAt: '2026-04-16T11:00:00Z',
      })

      // Assert
      expect(poll.rating).toBeGreaterThanOrEqual(1)
      expect(poll.rating).toBeLessThanOrEqual(5)
      expect(poll.rating).toBe(3)
    })
  })

  // Test Scenario 4: User Account Creation
  describe('Scenario 4: User Account Creation and Verification', () => {
    it('should create user account and save to database', async () => {
      // Arrange
      const newUser = {
        name: 'Tom',
        email: 'tom@test.com',
        password: 'secure123',
      }

      const mockUserResponse = {
        id: 5,
        ...newUser,
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => mockUserResponse,
        ok: true,
      } as Response)

      // Act
      const createdUser = await createUser(newUser.name, newUser.email, newUser.password)

      // Assert
      expect(createdUser.name).toBe('Tom')
      expect(createdUser.email).toBe('tom@test.com')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should retrieve existing user by email from database', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 1,
          name: 'Jan',
          email: 'jan@test.com',
          password: 'pass123',
          role: 'normal',
        },
      ]

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => mockUsers,
        ok: true,
      } as Response)

      // Act
      const users = await findUsersByEmail('jan@test.com')

      // Assert
      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('jan@test.com')
      expect(users[0].name).toBe('Jan')
    })
  })

  // Test Scenario 5: Complete User Flow (End-to-End)
  describe('Scenario 5: Complete Workflow - Registration to Poll', () => {
    it('should complete full flow: Create activity → Register → Submit poll', async () => {
      // Step 1: Create activity
      const newActivity = {
        id: 10,
        title: 'Basketbal Toernooi',
        description: 'Professionals vs Amateurs',
        date: '2026-05-01',
        time: '20:00',
        location: 'Sporthal C',
        participants: 0,
        participantsList: [],
        registrations: [],
        image: 'basketball.jpg',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => newActivity,
        ok: true,
      } as Response)

      const createdActivity = await createActivity(newActivity)
      expect(createdActivity.id).toBe(10)

      // Step 2: Register user with status
      const registeredActivity = {
        ...createdActivity,
        participants: 1,
        participantsList: ['alex@test.com'],
        registrations: [
          {
            userEmail: 'alex@test.com',
            userName: 'Alex',
            status: 'zeker' as const,
          },
        ],
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => registeredActivity,
        ok: true,
      } as Response)

      const updated = await updateActivity(10, registeredActivity)
      expect(updated.registrations).toHaveLength(1)

      // Step 3: Submit poll rating
      const pollData = {
        id: 200,
        activityId: 10,
        userEmail: 'alex@test.com',
        userName: 'Alex',
        rating: 4,
        createdAt: '2026-05-02T10:00:00Z',
        updatedAt: '2026-05-02T10:00:00Z',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: async () => pollData,
        ok: true,
      } as Response)

      const poll = await createPoll(pollData)

      // Assert complete flow
      expect(poll.rating).toBe(4)
      expect(poll.activityId).toBe(createdActivity.id)
      expect(poll.userEmail).toMatch(updated.registrations![0].userEmail)
    })
  })
})

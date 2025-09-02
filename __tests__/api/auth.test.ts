/**
 * @jest-environment node
 */
import { createRequest, createResponse } from 'node-mocks-http'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  workspace: {
    create: jest.fn(),
  },
  userWorkspace: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}))

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

// Mock NextAuth
jest.mock('next-auth/jwt', () => ({
  sign: jest.fn().mockResolvedValue('mock-jwt-token'),
}))

const mockPrisma = require('@/lib/prisma')
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

describe('/api/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('/api/auth/register', () => {
    it('creates a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        acceptTerms: true,
      }

      const hashedPassword = 'hashed-password'
      const mockUser = {
        id: 'user-123',
        email: userData.email,
        name: userData.name,
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        slug: 'test-workspace',
      }

      // Mock bcrypt hash
      mockBcrypt.hash.mockResolvedValue(hashedPassword)
      
      // Mock Prisma user not existing
      mockPrisma.user.findUnique.mockResolvedValue(null)
      
      // Mock successful transaction
      mockPrisma.$transaction.mockResolvedValue([mockUser, mockWorkspace])

      const request = new Request('http://localhost:3099/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const response = await registerHandler(request)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(result.success).toBe(true)
      expect(result.data.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      })
      expect(result.data.workspace).toMatchObject({
        id: mockWorkspace.id,
        name: mockWorkspace.name,
      })

      // Verify password was hashed
      expect(mockBcrypt.hash).toHaveBeenCalledWith(userData.password, 12)
    })

    it('returns error when email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
        acceptTerms: true,
      }

      // Mock user already exists
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: userData.email,
      })

      const request = new Request('http://localhost:3099/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const response = await registerHandler(request)
      const result = await response.json()

      expect(response.status).toBe(409)
      expect(result.success).toBe(false)
      expect(result.error).toBe('email_exists')
    })

    it('validates required fields', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // too short
        // missing name and acceptTerms
      }

      const request = new Request('http://localhost:3099/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      })

      const response = await registerHandler(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe('validation_error')
      expect(result.details).toBeDefined()
    })

    it('handles database errors gracefully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        acceptTerms: true,
      }

      mockBcrypt.hash.mockResolvedValue('hashed-password')
      mockPrisma.user.findUnique.mockResolvedValue(null)
      
      // Mock database error
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'))

      const request = new Request('http://localhost:3099/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const response = await registerHandler(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
      expect(result.error).toBe('registration_failed')
    })
  })

  describe('/api/auth/login', () => {
    it('authenticates user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      }

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        name: 'Test User',
        password: 'hashed-password',
        emailVerified: new Date(),
        workspaces: [{
          workspace: {
            id: 'workspace-123',
            name: 'Test Workspace',
            slug: 'test-workspace',
          }
        }]
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockBcrypt.compare.mockResolvedValue(true)

      const request = new Request('http://localhost:3099/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      })

      const response = await loginHandler(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      })
      expect(result.data.accessToken).toBeDefined()
      expect(result.data.refreshToken).toBeDefined()
    })

    it('returns error for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      }

      mockPrisma.user.findUnique.mockResolvedValue(null)

      const request = new Request('http://localhost:3099/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      })

      const response = await loginHandler(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid_credentials')
    })

    it('returns error for unverified email', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      }

      const mockUser = {
        id: 'user-123',
        email: loginData.email,
        password: 'hashed-password',
        emailVerified: null, // Not verified
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockBcrypt.compare.mockResolvedValue(true)

      const request = new Request('http://localhost:3099/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      })

      const response = await loginHandler(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toBe('email_not_verified')
    })

    it('validates login input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '',
      }

      const request = new Request('http://localhost:3099/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      })

      const response = await loginHandler(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe('validation_error')
    })
  })
})
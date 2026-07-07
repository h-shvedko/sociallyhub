/**
 * @jest-environment node
 *
 * ADR-0021 Track D legacy repair: the old suite targeted
 * /api/auth/register and /api/auth/login, which do not exist (auth is
 * NextAuth + /api/auth/signup). This tests the REAL signup handler's
 * validation and duplicate-email behavior with prisma/bcrypt/email mocked
 * (unit-style — no DB, no SMTP).
 */
// NOTE: use the GLOBAL jest for jest.mock() — importing jest from '@jest/globals'
// shadows the global and defeats SWC mock hoisting (see utils/jest-globals.d.ts).
import { describe, it, expect, beforeEach } from '@jest/globals'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    verificationToken: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn(), compare: jest.fn() },
  hash: jest.fn(),
  compare: jest.fn(),
}))

// The route dynamic-imports the email service; jest's module registry
// intercepts that too.
jest.mock('@/lib/notifications/email-service', () => ({
  emailService: { sendEmailVerification: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/notifications/email-service'

// Structural mock view — the repo has no @types/jest, so we avoid the
// jest.Mock namespace type and describe just the surface the tests drive.
interface MockFn {
  mockResolvedValue: (value: unknown) => unknown
  mockRejectedValue: (value: unknown) => unknown
  mockImplementation: (fn: (...args: never[]) => unknown) => unknown
}
const mockPrisma = prisma as unknown as {
  user: { findUnique: MockFn }
  verificationToken: { create: MockFn }
  $transaction: MockFn
}
const mockEmail = emailService as unknown as { sendEmailVerification: MockFn }

function signupRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3099/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validSignup = {
  name: 'Test User',
  email: 'signup-test@example.com',
  password: 'password12345',
  workspaceName: 'Test Workspace',
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    // jest.config clears mocks between tests — reinstall implementations.
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.verificationToken.create.mockResolvedValue({})
    const asyncFn = (value: unknown) => jest.fn<() => Promise<unknown>>().mockResolvedValue(value)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        user: {
          create: asyncFn({ id: 'user-1', email: validSignup.email, name: validSignup.name }),
        },
        workspace: {
          create: asyncFn({ id: 'ws-1', name: validSignup.workspaceName }),
        },
        userWorkspace: { create: asyncFn({}) },
        // ADR-0019: signup now seeds a 14-day PRO trial Subscription row.
        subscription: { create: asyncFn({}) },
      })
    )
    mockEmail.sendEmailVerification.mockResolvedValue(undefined)
  })

  it('400 when required fields are missing', async () => {
    const res = await signupHandler(signupRequest({ email: 'x@example.com' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toBe('Missing required fields')
  })

  it('400 when the password is shorter than 8 characters', async () => {
    const res = await signupHandler(signupRequest({ ...validSignup, password: 'short' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/at least 8 characters/i)
  })

  it('400 when the email is already registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: validSignup.email })
    const res = await signupHandler(signupRequest(validSignup))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/already exists/i)
  })

  it('201 on success: creates user+workspace, stores a verification token, sends the email', async () => {
    const res = await signupHandler(signupRequest(validSignup))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.emailVerificationRequired).toBe(true)
    expect(body.userId).toBe('user-1')
    expect(body.workspaceId).toBe('ws-1')
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledTimes(1)
    expect(mockEmail.sendEmailVerification).toHaveBeenCalledWith(
      validSignup.email,
      validSignup.name,
      expect.any(String)
    )
  })

  it('503 (never a fake success) when persistence fails', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('db down'))
    const res = await signupHandler(signupRequest(validSignup))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

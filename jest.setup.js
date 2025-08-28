import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
      workspace: {
        id: 'test-workspace-id',
        name: 'Test Workspace',
      },
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(),
}))

// Mock environment variables
process.env.NEXTAUTH_URL = 'http://localhost:3099'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sociallyhub_test'
process.env.REDIS_URL = 'redis://localhost:6379'

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock fetch globally
global.fetch = jest.fn()

// Mock console methods to reduce noise in tests
const consoleMethods = ['log', 'warn', 'error', 'info', 'debug']
consoleMethods.forEach(method => {
  const originalMethod = console[method]
  console[method] = (...args) => {
    // Only show errors and warnings in test output
    if (method === 'error' || method === 'warn') {
      originalMethod.apply(console, args)
    }
  }
})

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
})

// Global test utilities
global.testUtils = {
  mockUser: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mockWorkspace: {
    id: 'test-workspace-id',
    name: 'Test Workspace',
    slug: 'test-workspace',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mockPost: {
    id: 'test-post-id',
    text: 'Test post content',
    status: 'published',
    platforms: ['twitter', 'facebook'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
  
  // Clear fetch mock
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear()
  }
})
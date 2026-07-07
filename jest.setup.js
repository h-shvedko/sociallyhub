/**
 * Per-test-file setup, shared by ALL projects (Components=jsdom, API=node,
 * Unit=node). Anything DOM-specific is guarded so the node-env projects can
 * load this file safely.
 */

// jest-dom matchers are DOM-only; load them only under jsdom.
if (typeof window !== 'undefined') {
  require('@testing-library/jest-dom')
}

// Mock Next.js router (harmless in node env; needed by component tests).
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

// Mock NextAuth's React client (component tests render session consumers).
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

// Baseline env for tests (global-setup sets these too; kept here so files run
// identically under `jest --runTestsByPath` or editors that skip globalSetup).
process.env.NEXTAUTH_URL ||= 'http://localhost:3099'
process.env.NEXTAUTH_SECRET ||= 'test-secret'
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/sociallyhub_test'
process.env.REDIS_URL ||= 'redis://localhost:6379/1'

// jsdom-only browser API mocks.
if (typeof window !== 'undefined') {
  global.WebSocket = jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
  }))

  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  }))

  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
    unobserve: jest.fn(),
  }))

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
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

  // Component tests stub network calls; node suites keep real/undefined fetch.
  global.fetch = jest.fn()
}

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

// Cleanup after each test (clearMocks in jest.config.js also clears between
// tests; this additionally covers mocks created mid-test).
afterEach(() => {
  jest.clearAllMocks()
})

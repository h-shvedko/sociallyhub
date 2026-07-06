import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock data generators
export const mockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

export const mockWorkspace = (overrides = {}) => ({
  id: 'workspace-123',
  name: 'Test Workspace',
  slug: 'test-workspace',
  description: 'A test workspace',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

export const mockPost = (overrides = {}) => ({
  id: 'post-123',
  text: 'Test post content',
  status: 'published' as const,
  platforms: ['twitter', 'facebook'],
  scheduledFor: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  workspaceId: 'workspace-123',
  authorId: 'user-123',
  ...overrides,
})

export const mockSocialAccount = (overrides = {}) => ({
  id: 'account-123',
  platform: 'twitter' as const,
  accountId: 'twitter-123',
  username: 'testuser',
  displayName: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  accessToken: 'test-token',
  refreshToken: 'test-refresh-token',
  isActive: true,
  workspaceId: 'workspace-123',
  connectedAt: new Date('2024-01-01'),
  ...overrides,
})

export const mockAnalyticsMetric = (overrides = {}) => ({
  id: 'metric-123',
  metricType: 'engagement' as const,
  value: 100,
  timestamp: new Date('2024-01-01'),
  workspaceId: 'workspace-123',
  postId: 'post-123',
  platform: 'twitter' as const,
  ...overrides,
})

// API response helpers
export const mockApiResponse = (data: any, success = true) => ({
  success,
  data,
  meta: {
    timestamp: new Date().toISOString(),
    requestId: 'test-request-id',
  },
})

export const mockApiError = (message: string, code = 'test_error') => ({
  success: false,
  error: code,
  message,
  timestamp: new Date().toISOString(),
  requestId: 'test-request-id',
})

// Mock fetch responses
export const mockFetchSuccess = (data: any) => {
  const mockResponse = mockApiResponse(data)
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockResponse),
    headers: new Map([
      ['content-type', 'application/json'],
    ]),
  })
}

export const mockFetchError = (message: string, status = 400) => {
  const mockResponse = mockApiError(message)
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(mockResponse),
    headers: new Map([
      ['content-type', 'application/json'],
    ]),
  })
}

// Date helpers for testing
export const mockDate = (dateString: string) => {
  const mockDate = new Date(dateString)
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate)
  return mockDate
}

export const restoreDate = () => {
  jest.restoreAllMocks()
}

// Wait utilities
export const waitForNextTick = () => new Promise(resolve => process.nextTick(resolve))

export const waitForTimeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Local storage mock
export const mockLocalStorage = () => {
  const storage: Record<string, string> = {}
  
  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value
    },
    removeItem: (key: string) => {
      delete storage[key]
    },
    clear: () => {
      Object.keys(storage).forEach(key => delete storage[key])
    },
    get storage() {
      return { ...storage }
    },
  }
}

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now()
  await renderFn()
  const end = performance.now()
  return end - start
}

export const measureAsyncOperation = async (operation: () => Promise<any>) => {
  const start = performance.now()
  const result = await operation()
  const end = performance.now()
  return { result, duration: end - start }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Export the custom render as the default render
export { customRender as render }
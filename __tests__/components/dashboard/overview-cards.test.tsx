import { render, screen } from '@/__tests__/utils/test-helpers'
import { OverviewCards } from '@/components/dashboard/overview-cards'

// Mock the analytics API
jest.mock('@/lib/api/analytics', () => ({
  fetchAnalytics: jest.fn().mockResolvedValue({
    totalUsers: 1250,
    activeUsers: 890,
    totalPosts: 5420,
    totalEngagement: 12300,
    metrics: {
      userGrowth: 12.5,
      sessionGrowth: 8.2,
      postGrowth: 15.7,
      engagementGrowth: -3.1,
    }
  }),
}))

describe('OverviewCards', () => {
  beforeEach(() => {
    // Mock window.matchMedia for responsive checks
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  })

  it('renders all overview cards', async () => {
    render(<OverviewCards />)
    
    // Wait for data to load
    await screen.findByText('1,250')
    
    // Check if all cards are present
    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('Active Users')).toBeInTheDocument()
    expect(screen.getByText('Total Posts')).toBeInTheDocument()
    expect(screen.getByText('Total Engagement')).toBeInTheDocument()
  })

  it('displays correct metrics values', async () => {
    render(<OverviewCards />)
    
    await screen.findByText('1,250')
    
    expect(screen.getByText('1,250')).toBeInTheDocument()
    expect(screen.getByText('890')).toBeInTheDocument()
    expect(screen.getByText('5,420')).toBeInTheDocument()
    expect(screen.getByText('12,300')).toBeInTheDocument()
  })

  it('shows growth percentages with correct colors', async () => {
    render(<OverviewCards />)
    
    await screen.findByText('1,250')
    
    // Positive growth should be green
    const positiveGrowth = screen.getByText('+12.5%')
    expect(positiveGrowth).toHaveClass('text-green-600')
    
    // Negative growth should be red  
    const negativeGrowth = screen.getByText('-3.1%')
    expect(negativeGrowth).toHaveClass('text-red-600')
  })

  it('displays loading state initially', () => {
    render(<OverviewCards />)
    
    // Should show loading skeletons
    const loadingElements = screen.getAllByTestId('skeleton')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('handles API error gracefully', async () => {
    // Mock API error
    const mockFetchAnalytics = require('@/lib/api/analytics').fetchAnalytics
    mockFetchAnalytics.mockRejectedValueOnce(new Error('API Error'))
    
    render(<OverviewCards />)
    
    // Should show error message or fallback
    await screen.findByText(/unable to load/i)
  })

  it('formats large numbers correctly', async () => {
    // Mock different number formats
    const mockFetchAnalytics = require('@/lib/api/analytics').fetchAnalytics
    mockFetchAnalytics.mockResolvedValueOnce({
      totalUsers: 1250000,
      activeUsers: 890000,
      totalPosts: 5420000,
      totalEngagement: 12300000,
      metrics: {
        userGrowth: 12.5,
        sessionGrowth: 8.2,
        postGrowth: 15.7,
        engagementGrowth: -3.1,
      }
    })
    
    render(<OverviewCards />)
    
    // Should format large numbers with commas or abbreviations
    await screen.findByText(/1,250,000|1\.25M/i)
  })

  it('is accessible with proper ARIA labels', async () => {
    render(<OverviewCards />)
    
    await screen.findByText('1,250')
    
    // Check for proper accessibility attributes
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(4)
    
    cards.forEach(card => {
      expect(card).toHaveAttribute('aria-label')
    })
  })

  it('responds to theme changes', async () => {
    render(<OverviewCards />)
    
    await screen.findByText('1,250')
    
    // Cards should have theme-aware classes
    const cards = screen.getAllByRole('article')
    cards.forEach(card => {
      expect(card).toHaveClass('dark:bg-gray-800', 'bg-white')
    })
  })
})
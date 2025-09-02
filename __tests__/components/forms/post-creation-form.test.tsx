import { render, screen, userEvent, waitFor } from '@/__tests__/utils/test-helpers'
import { PostCreationForm } from '@/components/forms/post-creation-form'
import { mockPost, mockFetchSuccess, mockFetchError } from '@/__tests__/utils/test-helpers'

describe('PostCreationForm', () => {
  const mockOnSuccess = jest.fn()
  const mockOnCancel = jest.fn()

  const defaultProps = {
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful API response by default
    mockFetchSuccess({ post: mockPost() })
  })

  it('renders form elements correctly', () => {
    render(<PostCreationForm {...defaultProps} />)
    
    expect(screen.getByLabelText(/post content/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/platforms/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publish now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    // Try to submit without filling required fields
    await user.click(screen.getByRole('button', { name: /publish now/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/post content is required/i)).toBeInTheDocument()
      expect(screen.getByText(/select at least one platform/i)).toBeInTheDocument()
    })
  })

  it('allows text input and platform selection', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    const textArea = screen.getByLabelText(/post content/i)
    await user.type(textArea, 'This is a test post')
    
    expect(textArea).toHaveValue('This is a test post')
    
    // Select platforms
    const twitterCheckbox = screen.getByLabelText(/twitter/i)
    const facebookCheckbox = screen.getByLabelText(/facebook/i)
    
    await user.click(twitterCheckbox)
    await user.click(facebookCheckbox)
    
    expect(twitterCheckbox).toBeChecked()
    expect(facebookCheckbox).toBeChecked()
  })

  it('submits form with correct data for immediate posting', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    // Fill out the form
    await user.type(screen.getByLabelText(/post content/i), 'Test post content')
    await user.click(screen.getByLabelText(/twitter/i))
    await user.click(screen.getByLabelText(/facebook/i))
    
    // Submit for immediate posting
    await user.click(screen.getByRole('button', { name: /publish now/i }))
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test post content',
          platforms: ['twitter', 'facebook'],
          scheduledFor: null,
        }),
      })
    })
    
    expect(mockOnSuccess).toHaveBeenCalled()
  })

  it('handles scheduled posting', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    // Fill out the form
    await user.type(screen.getByLabelText(/post content/i), 'Scheduled post')
    await user.click(screen.getByLabelText(/twitter/i))
    
    // Set schedule date/time
    const dateInput = screen.getByLabelText(/schedule date/i)
    const timeInput = screen.getByLabelText(/schedule time/i)
    
    await user.type(dateInput, '2024-12-25')
    await user.type(timeInput, '10:00')
    
    // Submit for scheduled posting
    await user.click(screen.getByRole('button', { name: /schedule/i }))
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Scheduled post',
          platforms: ['twitter'],
          scheduledFor: '2024-12-25T10:00:00.000Z',
        }),
      })
    })
  })

  it('handles media upload', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    const fileInput = screen.getByLabelText(/upload media/i)
    const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
    
    await user.upload(fileInput, file)
    
    // Should show uploaded file
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })
  })

  it('shows character count and warnings', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    const textArea = screen.getByLabelText(/post content/i)
    const longText = 'a'.repeat(300) // Exceed typical social media limits
    
    await user.type(textArea, longText)
    
    // Should show character count
    expect(screen.getByText(/300.*characters/i)).toBeInTheDocument()
    
    // Should show warning for Twitter (280 char limit)
    expect(screen.getByText(/exceeds twitter limit/i)).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup()
    mockFetchError('Failed to create post', 500)
    
    render(<PostCreationForm {...defaultProps} />)
    
    // Fill out and submit form
    await user.type(screen.getByLabelText(/post content/i), 'Test post')
    await user.click(screen.getByLabelText(/twitter/i))
    await user.click(screen.getByRole('button', { name: /publish now/i }))
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to create post/i)).toBeInTheDocument()
    })
    
    // Should not call onSuccess
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    // Fill out form
    await user.type(screen.getByLabelText(/post content/i), 'Test post')
    await user.click(screen.getByLabelText(/twitter/i))
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /publish now/i }))
    
    // Should show loading state
    expect(screen.getByRole('button', { name: /publishing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publishing/i })).toBeDisabled()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('saves draft automatically', async () => {
    const user = userEvent.setup()
    render(<PostCreationForm {...defaultProps} enableDrafts />)
    
    const textArea = screen.getByLabelText(/post content/i)
    await user.type(textArea, 'Draft content')
    
    // Should save draft after typing stops
    await waitFor(() => {
      expect(localStorage.getItem).toHaveBeenCalledWith('post-draft')
    }, { timeout: 3000 })
  })

  it('loads existing draft on mount', () => {
    // Mock localStorage with existing draft
    const draftData = {
      text: 'Saved draft content',
      platforms: ['twitter'],
    }
    jest.spyOn(localStorage, 'getItem').mockReturnValue(JSON.stringify(draftData))
    
    render(<PostCreationForm {...defaultProps} enableDrafts />)
    
    expect(screen.getByDisplayValue('Saved draft content')).toBeInTheDocument()
    expect(screen.getByLabelText(/twitter/i)).toBeChecked()
  })
})
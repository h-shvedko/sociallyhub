import OpenAI from 'openai'

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key-for-demo',
  // For development, we might want to use a different base URL or organization
  ...(process.env.NODE_ENV === 'development' && !process.env.OPENAI_API_KEY && {
    baseURL: 'https://api.openai.com/v1' // Fallback for demo mode
  })
})

// OpenAI Configuration
export const AI_CONFIG = {
  models: {
    gpt4: 'gpt-4',
    gpt35Turbo: 'gpt-3.5-turbo',
    gpt4Turbo: 'gpt-4-turbo-preview'
  },
  maxTokens: {
    content: 2000,
    analysis: 1000,
    response: 500
  },
  temperature: {
    creative: 0.7,
    analytical: 0.3,
    precise: 0.1
  }
}

// Rate limiting configuration
export const RATE_LIMITS = {
  requests_per_minute: 60,
  tokens_per_minute: 10000,
  requests_per_hour: 1000
}

// Cost tracking (rough estimates in cents per 1K tokens)
export const COST_ESTIMATES = {
  'gpt-4': { input: 3, output: 6 },
  'gpt-3.5-turbo': { input: 0.15, output: 0.2 },
  'gpt-4-turbo-preview': { input: 1, output: 3 }
}
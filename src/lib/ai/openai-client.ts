import OpenAI from 'openai'

// Debug logging for environment variables
console.log('Environment check:', {
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  nodeEnv: process.env.NODE_ENV,
  keyLength: process.env.OPENAI_API_KEY?.length || 0
})

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is not set!')
  throw new Error('OPENAI_API_KEY environment variable is not set')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

console.log('OpenAI client initialized successfully')

export default openai
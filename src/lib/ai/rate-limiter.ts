// Rate Limiter for AI API calls

export class RateLimiter {
  private requestQueue: number[] = []
  private tokenQueue: number[] = []
  private readonly requestsPerMinute: number
  private readonly tokensPerMinute: number

  constructor(requestsPerMinute: number = 60, tokensPerMinute: number = 40000) {
    this.requestsPerMinute = requestsPerMinute
    this.tokensPerMinute = tokensPerMinute
  }

  async acquire(estimatedTokens: number = 500): Promise<void> {
    const now = Date.now()
    
    // Clean old entries (older than 1 minute)
    this.requestQueue = this.requestQueue.filter(time => now - time < 60000)
    this.tokenQueue = this.tokenQueue.filter(time => now - time < 60000)

    // Check if we need to wait for request limit
    while (this.requestQueue.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requestQueue)
      const waitTime = 60000 - (now - oldestRequest)
      if (waitTime > 0) {
        await this.sleep(waitTime)
      }
      // Clean queue again after waiting
      const currentTime = Date.now()
      this.requestQueue = this.requestQueue.filter(time => currentTime - time < 60000)
    }

    // Check if we need to wait for token limit
    const currentTokens = this.tokenQueue.length * 500 // Estimate average tokens per request
    while (currentTokens + estimatedTokens >= this.tokensPerMinute) {
      const oldestToken = Math.min(...this.tokenQueue)
      const waitTime = 60000 - (now - oldestToken)
      if (waitTime > 0) {
        await this.sleep(waitTime)
      }
      // Clean queue again after waiting
      const currentTime = Date.now()
      this.tokenQueue = this.tokenQueue.filter(time => currentTime - time < 60000)
    }

    // Add current request to queues
    this.requestQueue.push(now)
    this.tokenQueue.push(now)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getStats() {
    const now = Date.now()
    const recentRequests = this.requestQueue.filter(time => now - time < 60000).length
    const recentTokens = this.tokenQueue.filter(time => now - time < 60000).length * 500

    return {
      requestsUsed: recentRequests,
      requestsRemaining: Math.max(0, this.requestsPerMinute - recentRequests),
      tokensUsed: recentTokens,
      tokensRemaining: Math.max(0, this.tokensPerMinute - recentTokens)
    }
  }
}
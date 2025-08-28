// AI Safety Content Filter

import { SafetyFilter } from './types'

export class ContentSafetyFilter implements SafetyFilter {
  private inappropriateWords: Set<string>
  private spamPatterns: RegExp[]
  private sensitiveTopics: string[]

  constructor() {
    // Initialize with basic inappropriate content detection
    this.inappropriateWords = new Set([
      // Add your inappropriate words list here
      'spam', 'scam', 'fake', 'misleading'
    ])

    this.spamPatterns = [
      /buy now/gi,
      /click here/gi,
      /free money/gi,
      /get rich quick/gi,
      /urgent.*act now/gi,
      /limited time.*offer/gi
    ]

    this.sensitiveTopics = [
      'politics',
      'religion',
      'health claims',
      'financial advice',
      'legal advice'
    ]
  }

  async checkContent(content: string): Promise<{
    safe: boolean
    flags: string[]
    severity: 'low' | 'medium' | 'high'
    suggestions?: string[]
  }> {
    const flags: string[] = []
    const suggestions: string[] = []
    let severity: 'low' | 'medium' | 'high' = 'low'

    // Check for inappropriate words
    const words = content.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (this.inappropriateWords.has(word)) {
        flags.push(`Inappropriate language: ${word}`)
        severity = 'high'
        suggestions.push('Remove or replace inappropriate language')
      }
    }

    // Check for spam patterns
    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        flags.push(`Potential spam pattern detected: ${pattern.source}`)
        severity = Math.max(severity === 'low' ? 'medium' : severity, 'medium') as 'low' | 'medium' | 'high'
        suggestions.push('Avoid overly promotional language')
      }
    }

    // Check content length for spam
    if (content.length > 2000) {
      flags.push('Content unusually long')
      severity = 'low'
      suggestions.push('Consider shortening content for better engagement')
    }

    // Check for excessive capitalization
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length
    if (capsRatio > 0.3 && content.length > 20) {
      flags.push('Excessive capitalization detected')
      severity = 'medium'
      suggestions.push('Reduce use of capital letters to avoid appearing like spam')
    }

    // Check for excessive punctuation
    const punctuationRatio = (content.match(/[!?]{2,}/g) || []).length
    if (punctuationRatio > 0) {
      flags.push('Excessive punctuation detected')
      severity = 'low'
      suggestions.push('Use punctuation moderately for professional appearance')
    }

    // Check for potential sensitive topics (basic keyword matching)
    for (const topic of this.sensitiveTopics) {
      if (content.toLowerCase().includes(topic)) {
        flags.push(`Potentially sensitive topic: ${topic}`)
        severity = 'medium'
        suggestions.push(`Be cautious when discussing ${topic}`)
      }
    }

    // Check for suspicious links pattern
    const linkPattern = /https?:\/\/[^\s]+/g
    const links = content.match(linkPattern) || []
    if (links.length > 3) {
      flags.push('Multiple links detected')
      severity = 'medium'
      suggestions.push('Limit number of links to avoid appearing spammy')
    }

    // Determine if content is safe
    const safe = severity !== 'high' && flags.length < 3

    return {
      safe,
      flags,
      severity,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    }
  }

  // Method to add custom inappropriate words
  addInappropriateWords(words: string[]): void {
    for (const word of words) {
      this.inappropriateWords.add(word.toLowerCase())
    }
  }

  // Method to add custom spam patterns
  addSpamPattern(pattern: RegExp): void {
    this.spamPatterns.push(pattern)
  }

  // Method to add sensitive topics
  addSensitiveTopics(topics: string[]): void {
    this.sensitiveTopics.push(...topics)
  }
}
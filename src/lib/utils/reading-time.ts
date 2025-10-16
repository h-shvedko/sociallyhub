/**
 * Calculate estimated reading time for text content
 * Based on average reading speed of 200-250 words per minute
 */

export interface ReadingTimeResult {
  minutes: number
  words: number
  text: string
}

export function calculateReadingTime(content: string, wordsPerMinute: number = 225): ReadingTimeResult {
  // Remove HTML tags and markdown formatting
  const cleanText = content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
    .replace(/[#*`_~]/g, '') // Remove markdown formatting
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  // Count words (split by whitespace and filter empty strings)
  const words = cleanText.split(/\s+/).filter(word => word.length > 0).length

  // Calculate reading time in minutes
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute))

  // Generate readable text
  const text = minutes === 1 ? '1 min read' : `${minutes} min read`

  return {
    minutes,
    words,
    text
  }
}

/**
 * Check if content was recently updated (within specified days)
 */
export function isRecentlyUpdated(updatedAt: Date | string, daysThreshold: number = 7): boolean {
  const updateDate = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt
  const now = new Date()
  const diffInMs = now.getTime() - updateDate.getTime()
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24)

  return diffInDays <= daysThreshold
}

/**
 * Get relative time description for recently updated content
 */
export function getUpdateTimeText(updatedAt: Date | string): string {
  const updateDate = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt
  const now = new Date()
  const diffInMs = now.getTime() - updateDate.getTime()

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 60) {
    return diffInMinutes <= 1 ? 'Just updated' : `Updated ${diffInMinutes} minutes ago`
  } else if (diffInHours < 24) {
    return diffInHours === 1 ? 'Updated 1 hour ago' : `Updated ${diffInHours} hours ago`
  } else if (diffInDays <= 7) {
    return diffInDays === 1 ? 'Updated yesterday' : `Updated ${diffInDays} days ago`
  } else {
    return 'Recently updated'
  }
}
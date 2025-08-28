export * from './config'
export * from './get-dictionary'
export * from './translation-service'

// Utility functions for working with translations
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return values[key]?.toString() || match
  })
}

export function pluralize(
  count: number,
  singular: string,
  plural: string,
  includeCount = true
): string {
  const text = count === 1 ? singular : plural
  return includeCount ? `${count} ${text}` : text
}

export function formatRelativeTime(date: Date, locale: string = 'en'): string {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) {
    return 'just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`
  } else {
    return date.toLocaleDateString(locale)
  }
}
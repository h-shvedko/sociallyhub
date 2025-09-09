import { format, formatDistanceToNow } from 'date-fns'
import { 
  enUS, 
  es, 
  fr, 
  de, 
  ja, 
  pt, 
  it, 
  ru, 
  zh, 
  ko 
} from 'date-fns/locale'

// Supported locales mapping
const LOCALE_MAP = {
  'en': enUS,
  'es': es,
  'fr': fr,
  'de': de,
  'ja': ja,
  'pt': pt,
  'it': it,
  'ru': ru,
  'zh': zh,
  'ko': ko
}

// Timezone list for selection
export const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)', offset: '-05:00' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)', offset: '-06:00' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)', offset: '-07:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offset: '-08:00' },
  { value: 'America/Anchorage', label: 'Alaska Time', offset: '-09:00' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time', offset: '-10:00' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00' },
  { value: 'Europe/Berlin', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Paris', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Rome', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Madrid', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Amsterdam', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Brussels', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Zurich', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Vienna', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Prague', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Warsaw', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Stockholm', label: 'Central European Time', offset: '+01:00' },
  { value: 'Europe/Helsinki', label: 'Eastern European Time', offset: '+02:00' },
  { value: 'Europe/Athens', label: 'Eastern European Time', offset: '+02:00' },
  { value: 'Europe/Istanbul', label: 'Turkey Time', offset: '+03:00' },
  { value: 'Europe/Moscow', label: 'Moscow Time', offset: '+03:00' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time', offset: '+04:00' },
  { value: 'Asia/Karachi', label: 'Pakistan Standard Time', offset: '+05:00' },
  { value: 'Asia/Kolkata', label: 'India Standard Time', offset: '+05:30' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Standard Time', offset: '+06:00' },
  { value: 'Asia/Bangkok', label: 'Indochina Time', offset: '+07:00' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time', offset: '+08:00' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time', offset: '+08:00' },
  { value: 'Asia/Shanghai', label: 'China Standard Time', offset: '+08:00' },
  { value: 'Asia/Taipei', label: 'Taipei Standard Time', offset: '+08:00' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time', offset: '+09:00' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time', offset: '+09:00' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time', offset: '+10:00' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time', offset: '+10:00' },
  { value: 'Australia/Brisbane', label: 'Australian Eastern Time', offset: '+10:00' },
  { value: 'Australia/Perth', label: 'Australian Western Time', offset: '+08:00' },
  { value: 'Pacific/Auckland', label: 'New Zealand Standard Time', offset: '+12:00' }
]

// Date format options
export const DATE_FORMATS = [
  { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY (US)', example: '12/31/2023' },
  { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY (UK)', example: '31/12/2023' },
  { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD (ISO)', example: '2023-12-31' },
  { value: 'dd MMM yyyy', label: 'DD MMM YYYY', example: '31 Dec 2023' },
  { value: 'MMM dd, yyyy', label: 'MMM DD, YYYY', example: 'Dec 31, 2023' },
  { value: 'MMMM dd, yyyy', label: 'MMMM DD, YYYY', example: 'December 31, 2023' }
]

// Time format options
export const TIME_FORMATS = [
  { value: '12h', label: '12-hour (AM/PM)', example: '11:30 PM' },
  { value: '24h', label: '24-hour', example: '23:30' }
]

// Week start day options
export const WEEK_START_DAYS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' }
]

/**
 * Format a date according to user preferences
 */
export function formatDateWithPreferences(
  date: Date | string,
  dateFormat: string = 'MM/dd/yyyy',
  locale: string = 'en',
  timezone?: string
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date'
    }

    // Convert to user's timezone if provided
    let formattedDate = dateObj
    if (timezone && timezone !== 'UTC') {
      formattedDate = new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }))
    }

    const localeObj = LOCALE_MAP[locale as keyof typeof LOCALE_MAP] || enUS

    return format(formattedDate, dateFormat, { locale: localeObj })
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid Date'
  }
}

/**
 * Format a time according to user preferences
 */
export function formatTimeWithPreferences(
  date: Date | string,
  timeFormat: string = '12h',
  locale: string = 'en',
  timezone?: string
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Time'
    }

    // Convert to user's timezone if provided
    let formattedDate = dateObj
    if (timezone && timezone !== 'UTC') {
      formattedDate = new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }))
    }

    const localeObj = LOCALE_MAP[locale as keyof typeof LOCALE_MAP] || enUS
    const formatString = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'

    return format(formattedDate, formatString, { locale: localeObj })
  } catch (error) {
    console.error('Error formatting time:', error)
    return 'Invalid Time'
  }
}

/**
 * Format a datetime according to user preferences
 */
export function formatDateTimeWithPreferences(
  date: Date | string,
  dateFormat: string = 'MM/dd/yyyy',
  timeFormat: string = '12h',
  locale: string = 'en',
  timezone?: string
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid DateTime'
    }

    // Convert to user's timezone if provided
    let formattedDate = dateObj
    if (timezone && timezone !== 'UTC') {
      formattedDate = new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }))
    }

    const localeObj = LOCALE_MAP[locale as keyof typeof LOCALE_MAP] || enUS
    const timeFormatString = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
    const combinedFormat = `${dateFormat} ${timeFormatString}`

    return format(formattedDate, combinedFormat, { locale: localeObj })
  } catch (error) {
    console.error('Error formatting datetime:', error)
    return 'Invalid DateTime'
  }
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string = 'en'
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date'
    }

    const localeObj = LOCALE_MAP[locale as keyof typeof LOCALE_MAP] || enUS

    return formatDistanceToNow(dateObj, { 
      addSuffix: true,
      locale: localeObj 
    })
  } catch (error) {
    console.error('Error formatting relative time:', error)
    return 'Invalid Date'
  }
}

/**
 * Convert a date to a specific timezone
 */
export function convertToTimezone(
  date: Date | string,
  timezone: string
): Date {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date')
    }

    // Use Intl.DateTimeFormat to get the time in the target timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }

    const formatter = new Intl.DateTimeFormat('en-CA', options)
    const parts = formatter.formatToParts(dateObj)
    
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
    const second = parseInt(parts.find(p => p.type === 'second')?.value || '0')

    return new Date(year, month, day, hour, minute, second)
  } catch (error) {
    console.error('Error converting to timezone:', error)
    return new Date()
  }
}

/**
 * Get timezone offset in hours
 */
export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date()
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
    const targetTime = new Date(utcTime + (getTimezoneOffsetMinutes(timezone) * 60000))
    
    return (targetTime.getTime() - utcTime) / (1000 * 60 * 60)
  } catch (error) {
    console.error('Error getting timezone offset:', error)
    return 0
  }
}

/**
 * Get timezone offset in minutes
 */
export function getTimezoneOffsetMinutes(timezone: string): number {
  try {
    const date = new Date()
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
    const targetDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    
    return (targetDate.getTime() - utcDate.getTime()) / (1000 * 60)
  } catch (error) {
    console.error('Error getting timezone offset minutes:', error)
    return 0
  }
}

/**
 * Check if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get user's system timezone
 */
export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (error) {
    return 'UTC'
  }
}
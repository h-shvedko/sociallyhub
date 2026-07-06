import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { isValidTimezone } from '@/lib/utils/date-time'

// The 17 writable settings keys (ADR-0017). Keys not in this list are ignored.
const ALLOWED_FIELDS = [
  'theme', 'colorScheme', 'fontScale', 'compactMode', 'sidebarCollapsed',
  'language', 'timezone', 'dateFormat', 'timeFormat', 'weekStartDay',
  'defaultView', 'showWelcomeMessage', 'enableAnimations', 'enableSounds',
  'profileVisible', 'activityVisible', 'analyticsOptOut',
] as const

// Per-field enum allow-lists (exact schema values).
const ENUM_VALUES: Record<string, readonly string[]> = {
  theme: ['light', 'dark', 'system'],
  colorScheme: ['default', 'blue', 'green', 'purple'],
  fontScale: ['small', 'normal', 'large'],
  dateFormat: ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'],
  timeFormat: ['12h', '24h'],
  weekStartDay: ['sunday', 'monday'],
  defaultView: ['overview', 'posts', 'analytics', 'inbox'],
}

// Fields that must be booleans.
const BOOLEAN_FIELDS = new Set([
  'compactMode', 'sidebarCollapsed', 'showWelcomeMessage', 'enableAnimations',
  'enableSounds', 'profileVisible', 'activityVisible', 'analyticsOptOut',
])

export async function GET() {
  try {
    const user = await requireSession()

    // Get user settings with defaults
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    })

    // If no settings exist, create default settings
    if (!userSettings) {
      userSettings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          // All other fields will use defaults from schema
        },
      })
    }

    return NextResponse.json({ settings: userSettings })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSession()

    const body = await request.json()
    if (typeof body !== 'object' || body === null) {
      return jsonError(400, 'Invalid request body')
    }

    const updateData: Record<string, unknown> = {}

    for (const key of ALLOWED_FIELDS) {
      if (!(key in body)) continue
      const value = (body as Record<string, unknown>)[key]

      // Enum-valued string fields.
      if (key in ENUM_VALUES) {
        if (typeof value !== 'string' || !ENUM_VALUES[key].includes(value)) {
          return jsonError(400, `Invalid value for ${key}`)
        }
        updateData[key] = value
        continue
      }

      // Boolean fields.
      if (BOOLEAN_FIELDS.has(key)) {
        if (typeof value !== 'boolean') {
          return jsonError(400, `Invalid value for ${key}: expected a boolean`)
        }
        updateData[key] = value
        continue
      }

      // timezone — validate against the IANA database.
      if (key === 'timezone') {
        if (typeof value !== 'string' || !isValidTimezone(value)) {
          return jsonError(400, 'Invalid timezone')
        }
        updateData[key] = value
        continue
      }

      // language — free-form string (Track D constrains the UI to en).
      if (key === 'language') {
        if (typeof value !== 'string' || value.length === 0 || value.length > 16) {
          return jsonError(400, 'Invalid language')
        }
        updateData[key] = value
        continue
      }
    }

    // Upsert user settings
    const userSettings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: updateData,
      create: {
        userId: user.id,
        ...updateData,
      },
    })

    return NextResponse.json({
      settings: userSettings,
      message: 'Settings updated successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

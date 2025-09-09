import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'

// Default notification preferences structure
const DEFAULT_PREFERENCES = {
  APPROVAL_REQUESTED: { email: true, push: true, inApp: true },
  APPROVAL_GRANTED: { email: true, push: true, inApp: true },
  APPROVAL_DENIED: { email: true, push: true, inApp: true },
  PUBLISH_SUCCESS: { email: false, push: true, inApp: true },
  PUBLISH_FAILED: { email: true, push: true, inApp: true },
  TOKEN_EXPIRING: { email: true, push: true, inApp: true },
  TOKEN_EXPIRED: { email: true, push: true, inApp: true },
  INBOX_ASSIGNMENT: { email: true, push: true, inApp: true },
  SLA_BREACH: { email: true, push: true, inApp: true },
  REPORT_READY: { email: true, push: false, inApp: true },
  TEAM_INVITATION: { email: true, push: true, inApp: true },
  MENTION: { email: true, push: true, inApp: true },
  COMMENT: { email: false, push: true, inApp: true },
  LIKE: { email: false, push: false, inApp: true },
  SHARE: { email: false, push: true, inApp: true },
  FOLLOW: { email: true, push: true, inApp: true }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get notification preferences with defaults
    let notificationPreferences = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id }
    })

    // If no preferences exist, create default preferences
    if (!notificationPreferences) {
      notificationPreferences = await prisma.notificationPreferences.create({
        data: {
          userId: session.user.id,
          preferences: DEFAULT_PREFERENCES,
          // Other fields will use defaults from schema
        }
      })
    }

    return NextResponse.json({ 
      preferences: notificationPreferences,
      availableTypes: Object.keys(DEFAULT_PREFERENCES)
    })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate and sanitize input
    const allowedFields = [
      'preferences', 'emailEnabled', 'pushEnabled', 'inAppEnabled', 'soundEnabled',
      'dailyDigest', 'weeklyDigest', 'monthlyDigest', 'digestTime', 'digestTimezone',
      'dndEnabled', 'dndStartTime', 'dndEndTime', 'dndDays'
    ]

    const updateData: any = {}
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }

    // Validate preferences structure if provided
    if (updateData.preferences) {
      const preferences = updateData.preferences
      for (const [type, channels] of Object.entries(preferences)) {
        if (typeof channels !== 'object' || 
            !('email' in channels) || !('push' in channels) || !('inApp' in channels)) {
          return NextResponse.json(
            { error: `Invalid preference structure for type: ${type}` },
            { status: 400 }
          )
        }
      }
    }

    // Validate time formats
    if (updateData.digestTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.digestTime)) {
      return NextResponse.json(
        { error: 'Invalid digest time format. Use HH:mm' },
        { status: 400 }
      )
    }

    if (updateData.dndStartTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.dndStartTime)) {
      return NextResponse.json(
        { error: 'Invalid DND start time format. Use HH:mm' },
        { status: 400 }
      )
    }

    if (updateData.dndEndTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.dndEndTime)) {
      return NextResponse.json(
        { error: 'Invalid DND end time format. Use HH:mm' },
        { status: 400 }
      )
    }

    // Upsert notification preferences
    const notificationPreferences = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        preferences: DEFAULT_PREFERENCES,
        ...updateData
      }
    })

    return NextResponse.json({ 
      preferences: notificationPreferences,
      message: 'Notification preferences updated successfully' 
    })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}
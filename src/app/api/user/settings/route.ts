import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user settings with defaults
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id }
    })

    // If no settings exist, create default settings
    if (!userSettings) {
      userSettings = await prisma.userSettings.create({
        data: {
          userId: session.user.id,
          // All other fields will use defaults from schema
        }
      })
    }

    return NextResponse.json({ settings: userSettings })
  } catch (error) {
    console.error('Error fetching user settings:', error)
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
    
    // Validate required fields and sanitize input
    const allowedFields = [
      'theme', 'colorScheme', 'fontScale', 'compactMode', 'sidebarCollapsed',
      'language', 'timezone', 'dateFormat', 'timeFormat', 'weekStartDay',
      'defaultView', 'showWelcomeMessage', 'enableAnimations', 'enableSounds',
      'profileVisible', 'activityVisible', 'analyticsOptOut'
    ]

    const updateData: any = {}
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }

    // Upsert user settings
    const userSettings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData
      }
    })

    return NextResponse.json({ 
      settings: userSettings,
      message: 'Settings updated successfully' 
    })
  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Get user's workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, workspaceId }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Get or create budget settings
    let budgetSettings = await prisma.budgetSettings.findUnique({
      where: { workspaceId }
    })

    if (!budgetSettings) {
      // Create default settings
      budgetSettings = await prisma.budgetSettings.create({
        data: {
          workspaceId,
          defaultCurrency: 'USD',
          budgetAlerts: {
            enabled: true,
            warningThreshold: 75,
            criticalThreshold: 90,
            emailNotifications: true,
            slackNotifications: false
          },
          budgetLimits: {
            autoStop: false
          },
          reporting: {
            frequency: 'weekly',
            recipients: [],
            includeCostAnalysis: true,
            includeForecast: true
          }
        }
      })
    }

    return NextResponse.json({ settings: budgetSettings })
  } catch (error) {
    console.error('Error fetching budget settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budget settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { workspaceId, settings } = await request.json()

    if (!workspaceId || !settings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, workspaceId }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Update or create budget settings
    const budgetSettings = await prisma.budgetSettings.upsert({
      where: { workspaceId },
      update: {
        defaultCurrency: settings.defaultCurrency,
        budgetAlerts: settings.budgetAlerts,
        budgetLimits: settings.budgetLimits,
        reporting: settings.reporting,
        updatedAt: new Date()
      },
      create: {
        workspaceId,
        defaultCurrency: settings.defaultCurrency,
        budgetAlerts: settings.budgetAlerts,
        budgetLimits: settings.budgetLimits,
        reporting: settings.reporting
      }
    })

    return NextResponse.json({ 
      success: true, 
      settings: budgetSettings,
      message: 'Budget settings saved successfully'
    })
  } catch (error) {
    console.error('Error saving budget settings:', error)
    return NextResponse.json(
      { error: 'Failed to save budget settings' },
      { status: 500 }
    )
  }
}
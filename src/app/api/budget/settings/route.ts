import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify workspace access (ADR-0004; non-members get 404)
    await requireWorkspaceRole(workspaceId)

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
          warningThreshold: 75,
          criticalThreshold: 90,
          enableEmailAlerts: true,
          enablePushAlerts: true,
          autoStopAtLimit: false,
          reportFrequency: 'monthly',
          enableAutomatedReports: false,
          includeProjections: true,
          includeRecommendations: true
        }
      })
    }

    return NextResponse.json({ settings: budgetSettings })
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error)
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

    const { workspaceId, settings } = await request.json()

    if (!workspaceId || !settings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify workspace access (ADR-0004; non-members get 404)
    await requireWorkspaceRole(workspaceId)

    // Update or create budget settings
    const budgetSettings = await prisma.budgetSettings.upsert({
      where: { workspaceId },
      update: {
        defaultCurrency: settings.defaultCurrency || 'USD',
        budgetPeriod: settings.budgetPeriod || 'monthly',
        warningThreshold: settings.warningThreshold || 75,
        criticalThreshold: settings.criticalThreshold || 90,
        enableEmailAlerts: settings.enableEmailAlerts ?? true,
        enablePushAlerts: settings.enablePushAlerts ?? true,
        emailRecipients: settings.emailRecipients || [],
        dailyLimit: settings.dailyLimit,
        monthlyLimit: settings.monthlyLimit,
        perCampaignLimit: settings.perCampaignLimit,
        autoStopAtLimit: settings.autoStopAtLimit ?? false,
        reportFrequency: settings.reportFrequency || 'monthly',
        enableAutomatedReports: settings.enableAutomatedReports ?? false,
        reportRecipients: settings.reportRecipients || [],
        includeProjections: settings.includeProjections ?? true,
        includeRecommendations: settings.includeRecommendations ?? true,
        updatedAt: new Date()
      },
      create: {
        workspaceId,
        defaultCurrency: settings.defaultCurrency || 'USD',
        budgetPeriod: settings.budgetPeriod || 'monthly',
        warningThreshold: settings.warningThreshold || 75,
        criticalThreshold: settings.criticalThreshold || 90,
        enableEmailAlerts: settings.enableEmailAlerts ?? true,
        enablePushAlerts: settings.enablePushAlerts ?? true,
        emailRecipients: settings.emailRecipients || [],
        dailyLimit: settings.dailyLimit,
        monthlyLimit: settings.monthlyLimit,
        perCampaignLimit: settings.perCampaignLimit,
        autoStopAtLimit: settings.autoStopAtLimit ?? false,
        reportFrequency: settings.reportFrequency || 'monthly',
        enableAutomatedReports: settings.enableAutomatedReports ?? false,
        reportRecipients: settings.reportRecipients || [],
        includeProjections: settings.includeProjections ?? true,
        includeRecommendations: settings.includeRecommendations ?? true
      }
    })

    return NextResponse.json({ 
      success: true, 
      settings: budgetSettings,
      message: 'Budget settings saved successfully'
    })
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error)
    console.error('Error saving budget settings:', error)
    return NextResponse.json(
      { error: 'Failed to save budget settings' },
      { status: 500 }
    )
  }
}
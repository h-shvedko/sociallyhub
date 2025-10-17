import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/integrations - List integration settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const provider = searchParams.get('provider')
    const isActive = searchParams.get('isActive')
    const isConfigured = searchParams.get('isConfigured')

    // Check workspace permissions
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build where clause
    const where: any = {
      workspaceId: workspaceId
    }

    if (provider) {
      where.provider = provider
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (isConfigured !== null) {
      where.isConfigured = isConfigured === 'true'
    }

    const integrations = await prisma.integrationSetting.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [
        { provider: 'asc' },
        { name: 'asc' }
      ]
    })

    // Mask sensitive credentials
    const maskedIntegrations = integrations.map(integration => ({
      ...integration,
      credentials: integration.credentials ? '***HIDDEN***' : null
    }))

    // Group by provider
    const integrationsByProvider = maskedIntegrations.reduce((acc, integration) => {
      if (!acc[integration.provider]) {
        acc[integration.provider] = []
      }
      acc[integration.provider].push(integration)
      return acc
    }, {} as Record<string, any[]>)

    // Get statistics
    const stats = {
      totalIntegrations: integrations.length,
      providers: Object.keys(integrationsByProvider).length,
      activeIntegrations: integrations.filter(i => i.isActive).length,
      configuredIntegrations: integrations.filter(i => i.isConfigured).length,
      errorIntegrations: integrations.filter(i => i.errorCount > 0).length,
      recentlyUpdated: integrations.filter(i => {
        const daysSinceUpdate = (Date.now() - new Date(i.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        return daysSinceUpdate <= 7
      }).length
    }

    return NextResponse.json({
      integrations: integrationsByProvider,
      stats,
      total: integrations.length
    })

  } catch (error) {
    console.error('Failed to fetch integration settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch integration settings' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/integrations - Create integration setting
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      workspaceId,
      provider,
      name,
      config,
      credentials,
      isActive = true,
      syncInterval,
      features,
      webhookUrl,
      webhookSecret
    } = body

    // Validate required fields
    if (!workspaceId || !provider || !name || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, provider, name, config' },
        { status: 400 }
      )
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate provider
    const validProviders = [
      'DISCORD', 'SLACK', 'ZAPIER', 'GOOGLE_ANALYTICS', 'FACEBOOK_PIXEL',
      'STRIPE', 'PAYPAL', 'MAILCHIMP', 'SENDGRID', 'TWILIO', 'AWS', 'AZURE',
      'GCP', 'GITHUB', 'GITLAB', 'JIRA', 'ASANA', 'TRELLO', 'NOTION',
      'AIRTABLE', 'HUBSPOT', 'SALESFORCE', 'ZOOM', 'TEAMS', 'CALENDLY',
      'TYPEFORM', 'INTERCOM', 'ZENDESK', 'FRESHDESK', 'CUSTOM'
    ]

    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for existing integration with same provider and name
    const existingIntegration = await prisma.integrationSetting.findFirst({
      where: {
        workspaceId,
        provider,
        name
      }
    })

    if (existingIntegration) {
      return NextResponse.json(
        { error: 'Integration with this provider and name already exists' },
        { status: 409 }
      )
    }

    // Create integration
    const integration = await prisma.integrationSetting.create({
      data: {
        workspaceId,
        provider,
        name,
        config,
        credentials,
        isActive,
        isConfigured: credentials ? true : false,
        syncInterval,
        features,
        webhookUrl,
        webhookSecret,
        createdBy: normalizedUserId,
        lastUpdatedBy: normalizedUserId
      },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({
      integration: {
        ...integration,
        credentials: integration.credentials ? '***HIDDEN***' : null
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to create integration setting:', error)
    return NextResponse.json(
      { error: 'Failed to create integration setting' },
      { status: 500 }
    )
  }
}
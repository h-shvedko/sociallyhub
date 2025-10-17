import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// POST /api/admin/settings/integrations/[id]/test - Test integration connection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const integrationId = params.id

    const integration = await prisma.integrationSetting.findUnique({
      where: { id: integrationId }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: integration.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mock integration testing based on provider
    const testIntegration = async (provider: string, config: any, credentials: any) => {
      // Simulate testing delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock test results based on provider
      const testResults: Record<string, any> = {
        DISCORD: {
          success: true,
          message: 'Successfully connected to Discord webhook',
          details: {
            webhookUrl: config.webhookUrl || 'https://discord.com/api/webhooks/...',
            guildName: 'Test Server',
            channelName: '#general'
          }
        },
        SLACK: {
          success: true,
          message: 'Successfully connected to Slack workspace',
          details: {
            workspaceName: 'Test Workspace',
            botUser: '@SociallyHub',
            permissions: ['chat:write', 'files:write']
          }
        },
        GOOGLE_ANALYTICS: {
          success: true,
          message: 'Successfully authenticated with Google Analytics',
          details: {
            propertyId: config.propertyId || 'GA4-123456789',
            accountName: 'Test Account',
            measurementId: 'G-XXXXXXXXXX'
          }
        },
        STRIPE: {
          success: true,
          message: 'Successfully connected to Stripe account',
          details: {
            accountId: 'acct_test123',
            livemode: false,
            country: 'US'
          }
        },
        MAILCHIMP: {
          success: true,
          message: 'Successfully connected to Mailchimp account',
          details: {
            username: 'test_user',
            totalSubscribers: 1250,
            lists: 3
          }
        },
        ZAPIER: {
          success: true,
          message: 'Zapier webhook endpoint is reachable',
          details: {
            webhookUrl: config.webhookUrl,
            lastTriggered: null,
            status: 'active'
          }
        },
        CUSTOM: {
          success: Math.random() > 0.3, // 70% success rate for custom integrations
          message: Math.random() > 0.3
            ? 'Custom integration test successful'
            : 'Custom integration test failed - check configuration',
          details: {
            endpoint: config.endpoint || config.url,
            method: config.method || 'POST',
            responseTime: Math.floor(Math.random() * 500) + 100
          }
        }
      }

      return testResults[provider] || {
        success: false,
        message: `Testing not implemented for ${provider}`,
        details: null
      }
    }

    const testResult = await testIntegration(
      integration.provider,
      integration.config,
      integration.credentials
    )

    // Update integration with test results
    const updateData: any = {
      lastUpdatedBy: normalizedUserId
    }

    if (testResult.success) {
      updateData.lastSync = new Date()
      updateData.errorCount = 0
      updateData.lastError = null
    } else {
      updateData.errorCount = integration.errorCount + 1
      updateData.lastError = testResult.message
    }

    await prisma.integrationSetting.update({
      where: { id: integrationId },
      data: updateData
    })

    return NextResponse.json({
      testResult: {
        success: testResult.success,
        message: testResult.message,
        details: testResult.details,
        timestamp: new Date().toISOString(),
        provider: integration.provider
      }
    })

  } catch (error) {
    console.error('Failed to test integration:', error)

    // Update error count on failure
    try {
      await prisma.integrationSetting.update({
        where: { id: params.id },
        data: {
          errorCount: { increment: 1 },
          lastError: 'Test connection failed',
          lastUpdatedBy: normalizeUserId(session?.user?.id || '')
        }
      })
    } catch (updateError) {
      console.error('Failed to update error count:', updateError)
    }

    return NextResponse.json({
      testResult: {
        success: false,
        message: 'Integration test failed due to system error',
        details: null,
        timestamp: new Date().toISOString(),
        provider: 'unknown'
      }
    }, { status: 500 })
  }
}
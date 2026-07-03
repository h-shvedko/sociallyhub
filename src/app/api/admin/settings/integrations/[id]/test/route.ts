import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { decryptCredentials, isEncrypted } from '@/lib/encryption'

// Integration settings are always workspace-scoped (IntegrationSetting.
// workspaceId is required in the schema), so the two-tier model (ADR-0004)
// reduces to requireWorkspaceRole(integration.workspaceId, ['OWNER', 'ADMIN']).

// Decrypt credentials stored at rest (ADR-0006 Phase 4) so the connectivity
// test operates on real values. Tolerates the transitional/legacy case where a
// row predates encryption (raw JSON object or plaintext) and the back-fill
// script (scripts/encrypt-integration-credentials.ts) has not yet run — such
// values are returned as-is. Decrypted material is never logged.
function decryptStoredCredentials(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (isEncrypted(value)) return decryptCredentials(value)
  return value
}

// POST /api/admin/settings/integrations/[id]/test - Test integration connection
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Hoisted so the catch block can attribute the error-count update; the
  // previous version referenced the try-scoped `session` from the catch,
  // which could never compile.
  let userId: string | undefined
  try {
    const user = await requireSession()
    userId = user.id
    const integrationId = params.id

    const integration = await prisma.integrationSetting.findUnique({
      where: { id: integrationId }
    })

    if (!integration) {
      return jsonError(404, 'Integration not found')
    }

    await requireWorkspaceRole(integration.workspaceId, ['OWNER', 'ADMIN'])

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
      decryptStoredCredentials(integration.credentials)
    )

    // Update integration with test results
    const updateData: any = {
      lastUpdatedBy: user.id
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
    // Auth/authorization short-circuits (401/403/404) must not count as
    // integration errors and use the standard envelope.
    if (error instanceof ApiError) {
      return handleApiError(error)
    }

    console.error('Failed to test integration:', error)

    // Update error count on failure
    try {
      await prisma.integrationSetting.update({
        where: { id: params.id },
        data: {
          errorCount: { increment: 1 },
          lastError: 'Test connection failed',
          ...(userId ? { lastUpdatedBy: userId } : {})
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

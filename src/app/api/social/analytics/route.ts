import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { socialMediaManager } from '@/services/social-providers'
import { withLogging, BusinessLogger, ErrorLogger, SecurityLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { z } from 'zod'

const analyticsQuerySchema = z.object({
  accounts: z.array(z.object({
    platform: z.enum(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']),
    accountId: z.string()
  })).min(1, 'At least one account is required'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  metrics: z.array(z.string()).optional(),
  crossPlatform: z.boolean().optional().default(false)
})

async function handleGetAnalytics(request: NextRequest) {
  const timer = PerformanceLogger.startTimer('get_social_analytics')
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/analytics', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const queryData = {
      accounts: JSON.parse(searchParams.get('accounts') || '[]'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      metrics: searchParams.get('metrics')?.split(','),
      crossPlatform: searchParams.get('crossPlatform') === 'true'
    }

    // Validate input
    let validatedData
    try {
      validatedData = analyticsQuerySchema.parse(queryData)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Validation failed',
            issues: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          },
          { status: 400 }
        )
      }
      throw error
    }

    const startDate = new Date(validatedData.startDate)
    const endDate = new Date(validatedData.endDate)

    // Validate date range
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (endDate > now) {
      return NextResponse.json(
        { error: 'End date cannot be in the future' },
        { status: 400 }
      )
    }

    // Maximum 1 year date range
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    if (startDate < oneYearAgo) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 1 year' },
        { status: 400 }
      )
    }

    try {
      if (validatedData.crossPlatform) {
        // Get cross-platform analytics
        const result = await socialMediaManager.getCrossPlatformAnalytics(
          validatedData.accounts,
          { start: startDate, end: endDate }
        )

        if (!result.success) {
          ErrorLogger.logExternalServiceError(
            'social_media_manager',
            new Error(result.error || 'Cross-platform analytics failed'),
            { 
              userId: session.user.id, 
              operation: 'get_cross_platform_analytics',
              accounts: validatedData.accounts
            }
          )

          return NextResponse.json({
            error: 'Failed to fetch cross-platform analytics',
            details: result.error
          }, { status: 500 })
        }

        timer.end({
          type: 'cross_platform',
          accountCount: validatedData.accounts.length,
          dateRange: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        })

        return NextResponse.json({
          success: true,
          data: result.data,
          metadata: {
            type: 'cross_platform',
            dateRange: { startDate, endDate },
            accountCount: validatedData.accounts.length
          }
        })

      } else {
        // Get individual platform analytics
        const analyticsPromises = validatedData.accounts.map(async ({ platform, accountId }) => {
          const result = await socialMediaManager.getAnalytics(
            platform,
            accountId,
            { start: startDate, end: endDate }
          )

          return {
            platform,
            accountId,
            success: result.success,
            data: result.success ? result.data : null,
            error: result.success ? null : result.error
          }
        })

        const results = await Promise.all(analyticsPromises)
        
        const successfulResults = results.filter(r => r.success)
        const failedResults = results.filter(r => !r.success)

        if (failedResults.length > 0) {
          ErrorLogger.logExternalServiceError(
            'social_media_manager',
            new Error('Some analytics requests failed'),
            { 
              userId: session.user.id, 
              operation: 'get_individual_analytics',
              failedAccounts: failedResults.map(r => ({ platform: r.platform, accountId: r.accountId, error: r.error }))
            }
          )
        }

        timer.end({
          type: 'individual',
          accountCount: validatedData.accounts.length,
          successCount: successfulResults.length,
          failureCount: failedResults.length,
          dateRange: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        })

        return NextResponse.json({
          success: true,
          data: {
            results,
            summary: {
              total: results.length,
              successful: successfulResults.length,
              failed: failedResults.length
            }
          },
          metadata: {
            type: 'individual',
            dateRange: { startDate, endDate },
            accountCount: validatedData.accounts.length
          }
        })
      }

    } catch (error) {
      timer.end({ error: true })
      
      ErrorLogger.logExternalServiceError(
        'social_media_manager',
        error as Error,
        { 
          userId: session.user.id, 
          operation: 'get_analytics',
          accounts: validatedData.accounts
        }
      )

      return NextResponse.json(
        { 
          error: 'Failed to fetch analytics',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    timer.end({ error: true })
    
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/analytics',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleGetAccountStatus(request: NextRequest) {
  const timer = PerformanceLogger.startTimer('get_account_status')
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/analytics/status', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    try {
      const accountStatuses = await socialMediaManager.checkAccountStatuses()
      
      const activeAccounts = accountStatuses.filter(s => s.status === 'active')
      const errorAccounts = accountStatuses.filter(s => s.status === 'error')
      const rateLimitedAccounts = accountStatuses.filter(s => s.status === 'rate_limited')

      BusinessLogger.logWorkspaceAction(
        'account_status_check',
        session.user.workspaceId || 'default',
        session.user.id,
        {
          totalAccounts: accountStatuses.length,
          activeAccounts: activeAccounts.length,
          errorAccounts: errorAccounts.length,
          rateLimitedAccounts: rateLimitedAccounts.length
        }
      )

      timer.end({
        accountCount: accountStatuses.length,
        activeCount: activeAccounts.length,
        errorCount: errorAccounts.length
      })

      return NextResponse.json({
        success: true,
        data: {
          statuses: accountStatuses,
          summary: {
            total: accountStatuses.length,
            active: activeAccounts.length,
            errors: errorAccounts.length,
            rateLimited: rateLimitedAccounts.length,
            platforms: [...new Set(accountStatuses.map(s => s.platform))]
          }
        }
      })

    } catch (error) {
      timer.end({ error: true })
      
      ErrorLogger.logExternalServiceError(
        'social_media_manager',
        error as Error,
        { 
          userId: session.user.id, 
          operation: 'check_account_statuses'
        }
      )

      return NextResponse.json(
        { 
          error: 'Failed to check account statuses',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    timer.end({ error: true })
    
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/analytics/status',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(handleGetAnalytics, 'social-analytics')
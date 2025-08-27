import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { socialMediaManager } from '@/services/social-providers'
import { withLogging, BusinessLogger, ErrorLogger, SecurityLogger, PerformanceLogger } from '@/lib/middleware/logging'

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
      const inactiveAccounts = accountStatuses.filter(s => s.status === 'inactive')

      BusinessLogger.logWorkspaceAction(
        'account_status_check',
        session.user.workspaceId || 'default',
        session.user.id,
        {
          totalAccounts: accountStatuses.length,
          activeAccounts: activeAccounts.length,
          errorAccounts: errorAccounts.length,
          rateLimitedAccounts: rateLimitedAccounts.length,
          inactiveAccounts: inactiveAccounts.length
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
            inactive: inactiveAccounts.length,
            platforms: [...new Set(accountStatuses.map(s => s.platform))],
            connectedPlatforms: socialMediaManager.getConnectedPlatforms(),
            accountsByPlatform: socialMediaManager.getAccountCountByPlatform()
          },
          healthScore: calculateHealthScore(accountStatuses),
          recommendations: generateRecommendations(accountStatuses)
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

function calculateHealthScore(statuses: Array<{ status: string }>): number {
  if (statuses.length === 0) return 0
  
  const weights = {
    active: 1,
    inactive: 0.5,
    rate_limited: 0.3,
    error: 0
  }
  
  const totalScore = statuses.reduce((sum, status) => {
    return sum + (weights[status.status as keyof typeof weights] || 0)
  }, 0)
  
  return Math.round((totalScore / statuses.length) * 100)
}

function generateRecommendations(statuses: Array<{ status: string; platform: string; error?: string; rateLimitReset?: Date }>): string[] {
  const recommendations: string[] = []
  
  const errorAccounts = statuses.filter(s => s.status === 'error')
  const rateLimitedAccounts = statuses.filter(s => s.status === 'rate_limited')
  const inactiveAccounts = statuses.filter(s => s.status === 'inactive')
  
  if (errorAccounts.length > 0) {
    recommendations.push(`${errorAccounts.length} account(s) have errors and need attention`)
  }
  
  if (rateLimitedAccounts.length > 0) {
    const nextReset = rateLimitedAccounts
      .filter(a => a.rateLimitReset)
      .map(a => a.rateLimitReset!)
      .sort((a, b) => a.getTime() - b.getTime())[0]
    
    if (nextReset) {
      const minutes = Math.ceil((nextReset.getTime() - Date.now()) / (1000 * 60))
      recommendations.push(`${rateLimitedAccounts.length} account(s) are rate limited. Next reset in ~${minutes} minutes`)
    }
  }
  
  if (inactiveAccounts.length > 0) {
    recommendations.push(`${inactiveAccounts.length} account(s) are inactive and may need reconnection`)
  }
  
  if (statuses.length === 0) {
    recommendations.push('Connect social media accounts to start posting and analytics')
  }
  
  const platforms = [...new Set(statuses.map(s => s.platform))]
  if (platforms.length < 3) {
    recommendations.push('Consider connecting more social media platforms to expand your reach')
  }
  
  return recommendations
}

export const GET = withLogging(handleGetAccountStatus, 'social-account-status')
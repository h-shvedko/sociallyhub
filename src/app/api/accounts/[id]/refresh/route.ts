import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { socialMediaManager } from '@/services/social-providers'

// POST /api/accounts/[id]/refresh - Refresh account token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: accountId } = await params

    // Get user's workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get the account
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    try {
      // Check if account has a refresh token
      if (!account.refreshToken) {
        return NextResponse.json({ 
          error: 'No refresh token available. Please reconnect the account.' 
        }, { status: 400 })
      }

      // Try to refresh the token using the social media manager
      const refreshResult = await socialMediaManager.refreshToken(
        account.provider.toLowerCase() as any,
        account.refreshToken
      )

      if (!refreshResult.success || !refreshResult.data) {
        // Mark account as having token issues
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { 
            status: 'TOKEN_EXPIRED',
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          error: 'Failed to refresh token. Please reconnect the account.',
          needsReconnection: true
        }, { status: 400 })
      }

      // Update the account with new tokens
      const updatedAccount = await prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          accessToken: refreshResult.data.accessToken,
          refreshToken: refreshResult.data.refreshToken || account.refreshToken,
          tokenExpiry: refreshResult.data.expiresAt ? new Date(refreshResult.data.expiresAt) : null,
          status: 'ACTIVE',
          updatedAt: new Date()
        },
        include: {
          client: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      console.log(`🔄 Refreshed token for ${account.displayName} (${account.provider})`)

      return NextResponse.json({
        success: true,
        account: {
          ...updatedAccount,
          // Don't expose sensitive token data
          accessToken: undefined,
          refreshToken: undefined
        }
      })
    } catch (error) {
      console.error('Token refresh failed:', error)
      
      // Mark account as having issues
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { 
          status: 'ERROR',
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        error: 'Token refresh failed. Please check your account connection.',
        needsReconnection: true
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Account refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh account' },
      { status: 500 }
    )
  }
}
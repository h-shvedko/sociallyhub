// Social Accounts API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No access to workspace' }, { status: 403 })
    }

    // Get social accounts for the workspace
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId: workspaceId
      },
      select: {
        id: true,
        provider: true,
        accountId: true,
        displayName: true,
        handle: true,
        accountType: true,
        status: true,
        scopes: true,
        metadata: true,
        tokenExpiry: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { provider: 'asc' },
        { displayName: 'asc' }
      ]
    })

    // Get account statistics
    const accountsWithStats = await Promise.all(
      socialAccounts.map(async (account) => {
        const [postsCount, inboxItemsCount, lastPostDate] = await Promise.all([
          // Count posts for this account
          prisma.postVariant.count({
            where: { socialAccountId: account.id }
          }),
          
          // Count inbox items for this account
          prisma.inboxItem.count({
            where: { socialAccountId: account.id }
          }),
          
          // Get last post date
          prisma.postVariant.findFirst({
            where: { socialAccountId: account.id },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' }
          })
        ])

        return {
          ...account,
          stats: {
            postsCount,
            inboxItemsCount,
            lastPostDate: lastPostDate?.createdAt || null
          }
        }
      })
    )

    return NextResponse.json(accountsWithStats)

  } catch (error) {
    console.error('Accounts API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}